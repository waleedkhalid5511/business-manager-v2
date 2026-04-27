import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function FileManagement({ profile }) {
  const [files, setFiles] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filterClient, setFilterClient] = useState('all')
  const [filterProject, setFilterProject] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [uploadForm, setUploadForm] = useState({
    client_id: '', project_name: '', version_label: 'v1',
    is_final: false, notes: ''
  })
  const [selectedFiles, setSelectedFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (!profile) return
    fetchAll()

    const sub = supabase
      .channel(`files-live-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, () => fetchFiles())
      .subscribe()

    return () => sub.unsubscribe()
  }, [profile])

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 5000)
      return () => clearTimeout(t)
    }
  }, [message])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([fetchFiles(), fetchClients(), fetchProjects()])
    setLoading(false)
  }

  const fetchFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*, profiles(full_name), client:clients(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setFiles(data || [])
    } catch (e) {
      console.error('fetchFiles error:', e)
    }
  }

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients(data || [])
  }

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('tasks').select('project').not('project', 'is', null)
    const unique = [...new Set((data || []).map(t => t.project).filter(Boolean))]
    setProjects(unique)
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    setSelectedFiles(files)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    setSelectedFiles(files)
  }

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) {
      setMessage('❌ Please select files to upload!')
      return
    }

    setUploading(true)

    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
        const filePath = `${uploadForm.client_id || 'general'}/${uploadForm.project_name || 'general'}/${fileName}`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('project-files')
          .getPublicUrl(filePath)

        // Save to files table
        const { error: dbError } = await supabase.from('files').insert({
          name: `${uploadForm.version_label ? `[${uploadForm.version_label}] ` : ''}${file.name}`,
          original_name: file.name,
          file_path: filePath,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type || fileExt,
          version: getVersionNumber(uploadForm.version_label),
          version_label: uploadForm.version_label || 'v1',
          project_name: uploadForm.project_name || null,
          client_id: uploadForm.client_id || null,
          uploaded_by: profile.id,
          is_final: uploadForm.is_final,
        })

        if (dbError) throw dbError
      }

      setMessage(`✅ ${selectedFiles.length} file(s) uploaded!`)
      setSelectedFiles([])
      setShowUploadModal(false)
      setUploadForm({ client_id: '', project_name: '', version_label: 'v1', is_final: false, notes: '' })
      fetchFiles()
    } catch (e) {
      setMessage('❌ Upload failed: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteFile = async (file) => {
    if (!window.confirm('Delete this file?')) return
    try {
      // Delete from storage
      await supabase.storage.from('project-files').remove([file.file_path])
      // Delete from DB
      await supabase.from('files').delete().eq('id', file.id)
      setMessage('✅ File deleted!')
      setShowDetail(null)
      fetchFiles()
    } catch (e) {
      setMessage('❌ ' + e.message)
    }
  }

  const markAsFinal = async (file) => {
    await supabase.from('files').update({ is_final: !file.is_final }).eq('id', file.id)
    fetchFiles()
    if (showDetail?.id === file.id) setShowDetail(prev => ({ ...prev, is_final: !prev.is_final }))
  }

  const getVersionNumber = (label) => {
    if (!label) return 1
    const match = label.match(/\d+/)
    return match ? parseInt(match[0]) : 1
  }

  const formatSize = (bytes) => {
    if (!bytes) return '—'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (type) => {
    if (!type) return '📄'
    if (type.includes('video')) return '🎬'
    if (type.includes('image')) return '🖼️'
    if (type.includes('pdf')) return '📕'
    if (type.includes('zip') || type.includes('rar')) return '🗜️'
    if (type.includes('audio')) return '🎵'
    if (type.includes('word') || type.includes('doc')) return '📝'
    if (type.includes('excel') || type.includes('sheet')) return '📊'
    return '📄'
  }

  const getVersionColor = (label) => {
    if (!label) return '#888'
    if (label === 'final' || label === 'Final') return '#16a34a'
    const num = getVersionNumber(label)
    if (num >= 3) return '#d71920'
    if (num === 2) return '#d97706'
    return '#2563eb'
  }

  // Group files by client → project → versions
  const groupedFiles = files.reduce((groups, file) => {
    const clientKey = file.client?.name || 'No Client'
    const projectKey = file.project_name || 'No Project'

    if (!groups[clientKey]) groups[clientKey] = {}
    if (!groups[clientKey][projectKey]) groups[clientKey][projectKey] = []
    groups[clientKey][projectKey].push(file)
    return groups
  }, {})

  const filtered = files.filter(f => {
    const matchSearch = !search ||
      f.name?.toLowerCase().includes(search.toLowerCase()) ||
      f.project_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.client?.name?.toLowerCase().includes(search.toLowerCase())
    const matchClient = filterClient === 'all' || f.client_id === filterClient
    const matchProject = filterProject === 'all' || f.project_name === filterProject
    const matchType = filterType === 'all' ||
      (filterType === 'video' && f.file_type?.includes('video')) ||
      (filterType === 'image' && f.file_type?.includes('image')) ||
      (filterType === 'final' && f.is_final)
    return matchSearch && matchClient && matchProject && matchType
  })

  // Stats
  const totalSize = files.reduce((sum, f) => sum + (f.file_size || 0), 0)
  const finalFiles = files.filter(f => f.is_final).length
  const videoFiles = files.filter(f => f.file_type?.includes('video')).length

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: '#111', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>Files</h2>
          <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>
            {files.length} files · {formatSize(totalSize)} total
          </p>
        </div>
        <button onClick={() => setShowUploadModal(true)} className="btn btn-primary btn-sm">
          ⬆️ Upload Files
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        {[
          { icon: '📁', label: 'Total Files', value: files.length, color: '#2563eb' },
          { icon: '✅', label: 'Final', value: finalFiles, color: '#16a34a' },
          { icon: '🎬', label: 'Videos', value: videoFiles, color: '#7c3aed' },
          { icon: '💾', label: 'Total Size', value: formatSize(totalSize), color: '#d97706' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'white', borderRadius: '10px', padding: '14px',
            textAlign: 'center', border: `1px solid ${stat.color}22`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{stat.icon}</div>
            <div style={{ color: stat.color, fontSize: '18px', fontWeight: '800' }}>{stat.value}</div>
            <div style={{ color: '#888', fontSize: '11px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Search files..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px', padding: '8px 14px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}
        />
        <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
          style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}>
          <option value="all">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
          style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}>
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}>
          <option value="all">All Types</option>
          <option value="video">🎬 Videos</option>
          <option value="image">🖼️ Images</option>
          <option value="final">✅ Final Only</option>
        </select>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          background: message.includes('❌') ? 'rgba(215,25,32,0.08)' : 'rgba(22,163,74,0.08)',
          border: `1px solid ${message.includes('❌') ? 'rgba(215,25,32,0.2)' : 'rgba(22,163,74,0.2)'}`,
          color: message.includes('❌') ? '#d71920' : '#16a34a',
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
        }}>{message}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📁</div>
          <div className="empty-title">No files yet</div>
          <div className="empty-desc">Upload your first file</div>
          <button onClick={() => setShowUploadModal(true)} className="btn btn-primary" style={{ marginTop: '12px' }}>
            ⬆️ Upload Files
          </button>
        </div>
      ) : (
        /* Grouped View — Client → Project → Files */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.entries(groupedFiles).map(([clientName, projectMap]) => (
            <div key={clientName}>
              {/* Client Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '10px', padding: '10px 14px',
                background: 'white', borderRadius: '10px',
                border: '1px solid #e5e5e5',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #d71920, #b5151b)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: '800', fontSize: '14px'
                }}>
                  {clientName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ color: '#111', fontWeight: '800', fontSize: '15px' }}>👤 {clientName}</div>
                  <div style={{ color: '#888', fontSize: '11px' }}>
                    {Object.keys(projectMap).length} projects · {Object.values(projectMap).flat().length} files
                  </div>
                </div>
              </div>

              {/* Projects under Client */}
              {Object.entries(projectMap).map(([projectName, projectFiles]) => {
                const versions = [...new Set(projectFiles.map(f => f.version_label).filter(Boolean))]
                const hasFinal = projectFiles.some(f => f.is_final)

                return (
                  <div key={projectName} style={{
                    background: 'white', borderRadius: '12px',
                    border: '1px solid #e5e5e5', marginBottom: '10px',
                    marginLeft: '16px', overflow: 'hidden',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                  }}>
                    {/* Project Header */}
                    <div style={{
                      padding: '12px 16px', borderBottom: '1px solid #f0f0f0',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: '#f9f9f9'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>📁</span>
                        <span style={{ color: '#111', fontWeight: '700', fontSize: '14px' }}>{projectName}</span>
                        <span style={{ color: '#888', fontSize: '12px' }}>{projectFiles.length} files</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {versions.map(v => (
                          <span key={v} style={{
                            background: `${getVersionColor(v)}12`,
                            color: getVersionColor(v),
                            padding: '2px 8px', borderRadius: '20px',
                            fontSize: '10px', fontWeight: '800'
                          }}>
                            {v}
                          </span>
                        ))}
                        {hasFinal && (
                          <span style={{
                            background: 'rgba(22,163,74,0.1)', color: '#16a34a',
                            padding: '2px 8px', borderRadius: '20px',
                            fontSize: '10px', fontWeight: '800'
                          }}>
                            ✅ FINAL
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Files List */}
                    <div>
                      {projectFiles
                        .filter(f => {
                          const matchSearch = !search || f.name?.toLowerCase().includes(search.toLowerCase())
                          const matchType = filterType === 'all' ||
                            (filterType === 'video' && f.file_type?.includes('video')) ||
                            (filterType === 'image' && f.file_type?.includes('image')) ||
                            (filterType === 'final' && f.is_final)
                          return matchSearch && matchType
                        })
                        .map((file, idx) => (
                          <div key={file.id}
                            onClick={() => setShowDetail(file)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '12px 16px',
                              borderBottom: idx < projectFiles.length - 1 ? '1px solid #f5f5f5' : 'none',
                              cursor: 'pointer', transition: 'background 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f9f9f9'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {/* File Icon */}
                            <div style={{
                              width: '40px', height: '40px', borderRadius: '10px',
                              background: file.is_final ? 'rgba(22,163,74,0.1)' : '#f5f5f5',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '20px', flexShrink: 0,
                              border: file.is_final ? '1px solid rgba(22,163,74,0.2)' : '1px solid #e5e5e5'
                            }}>
                              {getFileIcon(file.file_type)}
                            </div>

                            {/* File Info */}
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                <span style={{
                                  color: '#111', fontSize: '13px', fontWeight: '600',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                }}>
                                  {file.original_name || file.name}
                                </span>
                                {file.is_final && (
                                  <span style={{
                                    background: 'rgba(22,163,74,0.1)', color: '#16a34a',
                                    padding: '1px 6px', borderRadius: '10px',
                                    fontSize: '10px', fontWeight: '800', flexShrink: 0
                                  }}>FINAL</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '8px', color: '#888', fontSize: '11px' }}>
                                <span>{formatSize(file.file_size)}</span>
                                <span>·</span>
                                <span>{new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                {file.profiles?.full_name && (
                                  <>
                                    <span>·</span>
                                    <span>by {file.profiles.full_name.split(' ')[0]}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Version Badge */}
                            <div style={{ flexShrink: 0, display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{
                                background: `${getVersionColor(file.version_label)}12`,
                                color: getVersionColor(file.version_label),
                                padding: '3px 10px', borderRadius: '20px',
                                fontSize: '11px', fontWeight: '800'
                              }}>
                                {file.version_label || 'v1'}
                              </span>

                              {/* Download Button */}
                              {file.file_url && (
                                <a href={file.file_url} target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    background: '#f5f5f5', border: '1px solid #e5e5e5',
                                    borderRadius: '6px', padding: '4px 8px',
                                    color: '#666', textDecoration: 'none',
                                    fontSize: '12px', fontWeight: '600'
                                  }}>
                                  ⬇️
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* FILE DETAIL MODAL */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" style={{ maxWidth: '480px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid #e5e5e5',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ color: '#111', margin: 0, fontSize: '17px', fontWeight: '800' }}>
                {getFileIcon(showDetail.file_type)} File Details
              </h3>
              <button onClick={() => setShowDetail(null)} style={{
                background: '#f5f5f5', border: 'none', borderRadius: '8px',
                color: '#888', cursor: 'pointer', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* File Name */}
              <div style={{
                background: '#f9f9f9', borderRadius: '10px', padding: '16px',
                marginBottom: '16px', border: '1px solid #e5e5e5',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: showDetail.is_final ? 'rgba(22,163,74,0.1)' : '#f0f0f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', flexShrink: 0
                }}>
                  {getFileIcon(showDetail.file_type)}
                </div>
                <div>
                  <div style={{ color: '#111', fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>
                    {showDetail.original_name || showDetail.name}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{
                      background: `${getVersionColor(showDetail.version_label)}12`,
                      color: getVersionColor(showDetail.version_label),
                      padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '800'
                    }}>
                      {showDetail.version_label || 'v1'}
                    </span>
                    {showDetail.is_final && (
                      <span style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' }}>
                        ✅ FINAL
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {[
                  { label: 'Size', value: formatSize(showDetail.file_size) },
                  { label: 'Type', value: showDetail.file_type?.split('/')[1]?.toUpperCase() || '—' },
                  { label: 'Client', value: showDetail.client?.name || 'No Client' },
                  { label: 'Project', value: showDetail.project_name || 'No Project' },
                  { label: 'Uploaded By', value: showDetail.profiles?.full_name || '—' },
                  { label: 'Date', value: new Date(showDetail.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                ].map(item => (
                  <div key={item.label} style={{ background: '#f9f9f9', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ color: '#bbb', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
                      {item.label}
                    </div>
                    <div style={{ color: '#111', fontSize: '13px', fontWeight: '600' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {showDetail.file_url && (
                  <a href={showDetail.file_url} target="_blank" rel="noopener noreferrer"
                    className="btn btn-primary btn-sm" style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}>
                    ⬇️ Download
                  </a>
                )}
                <button onClick={() => markAsFinal(showDetail)} className="btn btn-sm" style={{
                  background: showDetail.is_final ? 'rgba(215,25,32,0.08)' : 'rgba(22,163,74,0.08)',
                  color: showDetail.is_final ? '#d71920' : '#16a34a',
                  border: `1px solid ${showDetail.is_final ? 'rgba(215,25,32,0.2)' : 'rgba(22,163,74,0.2)'}`,
                  flex: 1, justifyContent: 'center'
                }}>
                  {showDetail.is_final ? '↩️ Unmark Final' : '✅ Mark as Final'}
                </button>
                {(isAdmin || profile?.id === showDetail.uploaded_by) && (
                  <button onClick={() => deleteFile(showDetail)} className="btn btn-danger btn-sm">
                    🗑️
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e5e5e5',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ color: '#111', margin: 0, fontSize: '17px', fontWeight: '800' }}>⬆️ Upload Files</h3>
              <button onClick={() => { setShowUploadModal(false); setSelectedFiles([]) }} style={{
                background: '#f5f5f5', border: 'none', borderRadius: '8px',
                color: '#888', cursor: 'pointer', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {message && (
                <div style={{
                  background: message.includes('❌') ? 'rgba(215,25,32,0.08)' : 'rgba(22,163,74,0.08)',
                  color: message.includes('❌') ? '#d71920' : '#16a34a',
                  padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
                }}>{message}</div>
              )}

              {/* Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#d71920' : selectedFiles.length > 0 ? '#16a34a' : '#e5e5e5'}`,
                  borderRadius: '12px', padding: '32px',
                  textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(215,25,32,0.04)' : selectedFiles.length > 0 ? 'rgba(22,163,74,0.04)' : '#f9f9f9',
                  transition: 'all 0.2s', marginBottom: '16px'
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file" multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                {selectedFiles.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                    <div style={{ color: '#16a34a', fontWeight: '700', fontSize: '14px' }}>
                      {selectedFiles.length} file(s) selected
                    </div>
                    <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>
                      {selectedFiles.map(f => f.name).join(', ')}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>☁️</div>
                    <div style={{ color: '#111', fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>
                      Drop files here or click to browse
                    </div>
                    <div style={{ color: '#888', fontSize: '12px' }}>
                      Videos, images, documents — any format
                    </div>
                  </div>
                )}
              </div>

              {/* Client */}
              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Client</label>
                <select value={uploadForm.client_id}
                  onChange={(e) => setUploadForm({ ...uploadForm, client_id: e.target.value })}
                  className="input">
                  <option value="">-- No Client --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Project */}
              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Project</label>
                <select value={uploadForm.project_name}
                  onChange={(e) => setUploadForm({ ...uploadForm, project_name: e.target.value })}
                  className="input">
                  <option value="">-- No Project --</option>
                  {projects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Version */}
              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Version Label</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['v1', 'v2', 'v3', 'v4', 'Final'].map(v => (
                    <button key={v} type="button"
                      onClick={() => setUploadForm({ ...uploadForm, version_label: v })}
                      style={{
                        padding: '7px 14px', borderRadius: '8px',
                        border: `1px solid ${uploadForm.version_label === v ? getVersionColor(v) : '#e5e5e5'}`,
                        background: uploadForm.version_label === v ? `${getVersionColor(v)}12` : 'white',
                        color: uploadForm.version_label === v ? getVersionColor(v) : '#666',
                        cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                        transition: 'all 0.15s'
                      }}>
                      {v}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={!['v1','v2','v3','v4','Final'].includes(uploadForm.version_label) ? uploadForm.version_label : ''}
                    onChange={(e) => setUploadForm({ ...uploadForm, version_label: e.target.value })}
                    placeholder="Custom..."
                    style={{ padding: '7px 12px', border: '1px solid #e5e5e5', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '90px' }}
                  />
                </div>
              </div>

              {/* Final Toggle */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#f9f9f9', borderRadius: '10px', padding: '14px',
                marginBottom: '20px', border: '1px solid #e5e5e5'
              }}>
                <div>
                  <div style={{ color: '#111', fontWeight: '600', fontSize: '14px' }}>Mark as Final</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>This is the final deliverable</div>
                </div>
                <div
                  onClick={() => setUploadForm({ ...uploadForm, is_final: !uploadForm.is_final })}
                  style={{
                    width: '48px', height: '26px', borderRadius: '13px',
                    background: uploadForm.is_final ? '#16a34a' : '#e5e5e5',
                    cursor: 'pointer', position: 'relative', transition: 'background 0.2s'
                  }}>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: 'white', position: 'absolute', top: '3px',
                    left: uploadForm.is_final ? '25px' : '3px',
                    transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setShowUploadModal(false); setSelectedFiles([]) }}
                  className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button onClick={uploadFiles} disabled={uploading || selectedFiles.length === 0}
                  className="btn btn-primary" style={{
                    flex: 2, justifyContent: 'center',
                    opacity: uploading || selectedFiles.length === 0 ? 0.7 : 1
                  }}>
                  {uploading ? '⟳ Uploading...' : `⬆️ Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
