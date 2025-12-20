import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/app.css';
import mockUsersData from '../data/mockUsers.json';

const AdminPage = () => {
    const [users, setUsers] = useState(mockUsersData);
    const [filter, setFilter] = useState('all');

    // Fetch real Beta Leads from server
    React.useEffect(() => {
        const fetchLeads = async () => {
            try {
                const res = await fetch('/api/leads');
                const data = await res.json();
                if (data.leads) {
                    const realUsers = data.leads.map((email, idx) => ({
                        id: `beta_${idx}`,
                        name: email.split('@')[0], // Derive name from email
                        email: email,
                        role: 'beta',
                        skills: { coding: true, design: true, marketing: true, legal: true, voice: true } // Auto-Grant All
                    }));
                    // Merge real users, filtering out duplicates if any
                    setUsers(prev => [...prev, ...realUsers]);
                }
            } catch (err) {
                console.error("Failed to load leads", err);
            }
        };
        fetchLeads();
    }, []);

    const skills = [
        { id: 'coding', label: 'Coding (IT)', icon: '💻' },
        { id: 'design', label: 'Design (Hanna)', icon: '🎨' },
        { id: 'marketing', label: 'Marketing (Sally)', icon: '📈' },
        { id: 'legal', label: 'Legal (Oracle)', icon: '⚖️' },
        { id: 'voice', label: 'Voice (Vesper)', icon: '🎙️' }
    ];

    const toggleSkill = (userId, skillId) => {
        setUsers(users.map(user => {
            if (user.id === userId) {
                const newSkills = { ...user.skills, [skillId]: !user.skills[skillId] };
                // Simulate API Call
                console.log(`[ADMIN] Toggled ${skillId} for ${user.name} to ${newSkills[skillId]}`);
                return { ...user, skills: newSkills };
            }
            return user;
        }));
    };

    const grantAll = (userId) => {
        setUsers(users.map(user => {
            if (user.id === userId) {
                const allSkills = {};
                skills.forEach(s => allSkills[s.id] = true);
                return { ...user, skills: allSkills };
            }
            return user;
        }));
    };

    const revokeAll = (userId) => {
        setUsers(users.map(user => {
            if (user.id === userId) {
                const noSkills = {};
                skills.forEach(s => noSkills[s.id] = false);
                return { ...user, skills: noSkills };
            }
            return user;
        }));
    };

    const filteredUsers = filter === 'all'
        ? users
        : users.filter(u => u.role === filter);

    return (
        <div className="admin-page" style={{ padding: '40px', background: '#111', minHeight: '100vh', color: '#ccc', fontFamily: 'monospace' }}>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ color: '#0f0', fontSize: '24px', margin: 0 }}>THE MATRIX // ADMIN CONTROL</h1>
                    <p style={{ margin: '10px 0 0', opacity: 0.6 }}>User Capability Switchboard v1.0</p>
                </div>
                <Link to="/" style={{ color: '#fff', textDecoration: 'none', border: '1px solid #333', padding: '8px 16px', borderRadius: '4px' }}>EXIT</Link>
            </header>

            <div style={{ marginBottom: '20px' }}>
                <span style={{ marginRight: '10px' }}>FILTER:</span>
                {['all', 'admin', 'beta', 'family', 'friend'].map(role => (
                    <button
                        key={role}
                        onClick={() => setFilter(role)}
                        style={{
                            background: filter === role ? '#333' : 'transparent',
                            color: filter === role ? '#fff' : '#666',
                            border: '1px solid #333',
                            padding: '5px 10px',
                            marginRight: '10px',
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                        }}
                    >
                        {role}
                    </button>
                ))}
            </div>

            <div className="matrix-grid" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #333' }}>
                            <th style={{ padding: '15px' }}>USER</th>
                            <th style={{ padding: '15px' }}>ROLE</th>
                            {skills.map(skill => (
                                <th key={skill.id} style={{ padding: '15px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '20px' }}>{skill.icon}</div>
                                    <div style={{ fontSize: '10px', marginTop: '5px', textTransform: 'uppercase' }}>{skill.id}</div>
                                </th>
                            ))}
                            <th style={{ padding: '15px', textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => (
                            <tr key={user.id} style={{ borderBottom: '1px solid #222' }}>
                                <td style={{ padding: '15px' }}>
                                    <div style={{ color: '#fff', fontWeight: 'bold' }}>{user.name}</div>
                                    <div style={{ fontSize: '12px', opacity: 0.5 }}>{user.email}</div>
                                </td>
                                <td style={{ padding: '15px' }}>
                                    <span style={{
                                        padding: '2px 6px',
                                        borderRadius: '3px',
                                        fontSize: '10px',
                                        background: user.role === 'admin' ? '#f00' : '#333',
                                        color: user.role === 'admin' ? '#fff' : '#aaa',
                                        textTransform: 'uppercase'
                                    }}>
                                        {user.role}
                                    </span>
                                </td>
                                {skills.map(skill => (
                                    <td key={skill.id} style={{ padding: '15px', textAlign: 'center' }}>
                                        <button
                                            onClick={() => toggleSkill(user.id, skill.id)}
                                            style={{
                                                width: '40px',
                                                height: '24px',
                                                background: user.skills[skill.id] ? '#0f0' : '#300',
                                                border: 'none',
                                                borderRadius: '12px',
                                                cursor: 'pointer',
                                                position: 'relative',
                                                boxShadow: user.skills[skill.id] ? '0 0 10px rgba(0,255,0,0.3)' : 'none'
                                            }}
                                        >
                                            <div style={{
                                                width: '18px',
                                                height: '18px',
                                                background: '#fff',
                                                borderRadius: '50%',
                                                position: 'absolute',
                                                top: '3px',
                                                left: user.skills[skill.id] ? '19px' : '3px',
                                                transition: 'left 0.2s'
                                            }} />
                                        </button>
                                    </td>
                                ))}
                                <td style={{ padding: '15px', textAlign: 'right' }}>
                                    <button onClick={() => grantAll(user.id)} style={{ background: 'none', border: '1px solid #333', color: '#0f0', fontSize: '10px', marginRight: '5px', cursor: 'pointer' }}>GRANT ALL</button>
                                    <button onClick={() => revokeAll(user.id)} style={{ background: 'none', border: '1px solid #333', color: '#f00', fontSize: '10px', cursor: 'pointer' }}>REVOKE</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminPage;
