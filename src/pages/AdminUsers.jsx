// src/pages/AdminUsers.jsx
import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Eye, EyeOff, Mail, Key, UserPlus, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    immatriculation: '',
    nom: '',
    prenom: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPassword, setShowPassword] = useState(false);

  const token = localStorage.getItem('token');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/auth/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch('http://localhost:8000/api/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Utilisateur créé avec succès' });
        setShowAddModal(false);
        setFormData({ email: '', password: '', immatriculation: '', nom: '', prenom: '' });
        loadUsers();
      } else {
        setMessage({ type: 'error', text: data.detail || 'Erreur lors de la création' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur de connexion' });
    }
  };

  const toggleUserActive = async (userId, currentStatus) => {
    try {
      const response = await fetch(`http://localhost:8000/api/auth/users/${userId}/toggle-active`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        loadUsers();
        setMessage({ type: 'success', text: 'Statut utilisateur mis à jour' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Gestion des Utilisateurs</div>
        <div className="page-sub">Administration des comptes et accès</div>
      </div>

      {/* Message de notification */}
      {message.text && (
        <div className="card" style={{
          marginBottom: '20px',
          background: message.type === 'success' ? '#3cd68a15' : '#ff4d6d15',
          borderColor: message.type === 'success' ? 'var(--green)' : 'var(--red)',
          padding: '12px 16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {message.type === 'success' ? <CheckCircle size={18} color="var(--green)" /> : <XCircle size={18} color="var(--red)" />}
            <span style={{ color: message.type === 'success' ? 'var(--green)' : 'var(--red)' }}>{message.text}</span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <div>
            <Users size={18} />
            <div className="card-title">Liste des utilisateurs</div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'linear-gradient(135deg, var(--blue), var(--blue2))',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            <UserPlus size={16} /> Ajouter
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Immatriculation</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Admin</th>
                <th>Statut</th>
                <th>Dernière connexion</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                    <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  </td>
                </tr>
              ) : users.map(user => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td className="mono">{user.immatriculation}</td>
                  <td>{user.nom || '-'}</td>
                  <td>{user.prenom || '-'}</td>
                  <td>{user.is_admin ? <span className="chip ok">Admin</span> : <span className="chip info">User</span>}</td>
                  <td>
                    <span className={`chip ${user.is_active ? 'ok' : 'deficit'}`}>
                      {user.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="mono">{user.last_login ? new Date(user.last_login).toLocaleDateString() : '-'}</td>
                  <td>
                    <button
                      onClick={() => toggleUserActive(user.id, user.is_active)}
                      style={{
                        background: user.is_active ? 'var(--red)' : 'var(--green)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 12px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      {user.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajout Utilisateur */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '90%' }}>
            <div className="card-header">
              <Plus size={18} />
              <div className="card-title">Ajouter un utilisateur</div>
            </div>
            
            <form onSubmit={handleAddUser}>
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label className="input-label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>
              
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label className="input-label">Mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label className="input-label">Immatriculation</label>
                <input
                  type="text"
                  value={formData.immatriculation}
                  onChange={(e) => setFormData({ ...formData, immatriculation: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>
              
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label className="input-label">Nom</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  style={inputStyle}
                />
              </div>
              
              <div className="input-group" style={{ marginBottom: '24px' }}>
                <label className="input-label">Prénom</label>
                <input
                  type="text"
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  style={inputStyle}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '10px 20px',
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text2)',
                    cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, var(--blue), var(--blue2))',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontSize: '14px',
  fontFamily: "'Outfit', sans-serif"
};

export default AdminUsers;