<div style={{ padding: '24px' }}>
  {/* Admin Personal Visibility */}
  <div style={{
    color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px'
  }}>
    My Sidebar — Toggle what YOU see
  </div>

  <div style={{
    background: 'var(--bg-hover)', borderRadius: '12px',
    padding: '16px', marginBottom: '20px',
    border: '1px solid var(--border)'
  }}>
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
      gap: '8px', marginBottom: '12px'
    }}>
      {[
        { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
        { id: 'messages', icon: '💬', label: 'Messages' },
        { id: 'projects', icon: '📁', label: 'Projects' },
        { id: 'tasks', icon: '✅', label: 'Tasks' },
        { id: 'attendance', icon: '📅', label: 'Attendance' },
        { id: 'employees', icon: '👥', label: 'People' },
        { id: 'payroll', icon: '💰', label: 'Payroll' },
        { id: 'settings', icon: '⚙️', label: 'Settings' },
      ].map(mod => {
        const isOn = adminVisibleModules.includes(mod.id)
        return (
          <div
            key={mod.id}
            onClick={() => toggleAdminModule(mod.id)}
            style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '10px 12px',
              borderRadius: '8px', cursor: 'pointer',
              background: isOn ? 'rgba(59,130,246,0.1)' : 'var(--bg-card)',
              border: `1px solid ${isOn ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '13px', color: isOn ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {mod.icon} {mod.label}
            </span>
            <div style={{
              width: '36px', height: '20px', borderRadius: '10px',
              background: isOn ? 'var(--accent-blue)' : 'var(--border)',
              position: 'relative', flexShrink: 0, transition: 'background 0.2s'
            }}>
              <div style={{
                width: '14px', height: '14px', borderRadius: '50%',
                background: 'white', position: 'absolute', top: '3px',
                left: isOn ? '19px' : '3px', transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }} />
            </div>
          </div>
        )
      })}
    </div>
    <button onClick={showAllModules} style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: '8px', padding: '8px 16px',
      color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px'
    }}>
      Reset — Show All
    </button>
  </div>

  {/* Partner/Employee Visibility */}
  <div style={{
    color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px'
  }}>
    Partner & Employee Visibility
  </div>

  {['partner', 'employee'].map(role => (
    <div key={role} style={{
      background: 'var(--bg-hover)', borderRadius: '12px',
      padding: '16px', marginBottom: '12px',
      border: '1px solid var(--border)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{
          background: `${{ partner: '#8b5cf6', employee: '#3b82f6' }[role]}22`,
          color: { partner: '#8b5cf6', employee: '#3b82f6' }[role],
          padding: '3px 10px', borderRadius: '20px',
          fontSize: '12px', fontWeight: '700', textTransform: 'capitalize'
        }}>
          {role}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
          can see these modules
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
        gap: '8px'
      }}>
        {['dashboard', 'messages', 'projects', 'tasks', 'attendance', 'employees', 'payroll', 'settings'].map(moduleId => (
          <ModuleToggle
            key={`${moduleId}-${role}`}
            moduleId={moduleId}
            role={role}
            initialValue={getModulePermission(moduleId, role)}
            onToggle={toggleModule}
          />
        ))}
      </div>
    </div>
  ))}
</div>
