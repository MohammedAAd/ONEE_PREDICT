// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, AlertCircle, Eye, EyeOff, Droplets, Sparkles, Shield, Activity } from 'lucide-react';

const Login = ({ onLogin, isDarkMode, toggleDarkMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Effet de suivi de souris pour le fond
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.user);
      } else {
        setError(data.detail || 'Email ou mot de passe incorrect');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: 'radial-gradient(ellipse at 20% 30%, #0a0f1e, #05080f)'
    }}>
      {/* Particules animées en arrière-plan */}
      <div className="particles">
        {[...Array(50)].map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${5 + Math.random() * 10}s`
          }} />
        ))}
      </div>

      {/* Effet de glow qui suit la souris */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(45, 139, 255, 0.15) 0%, transparent 70%)',
        borderRadius: '50%',
        left: mousePosition.x - 300,
        top: mousePosition.y - 300,
        pointerEvents: 'none',
        transition: 'transform 0.1s ease-out',
        zIndex: 0
      }} />

      {/* Grille 3D en arrière-plan */}
      <div className="grid-3d" />

      {/* Conteneur principal */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: '480px',
        margin: '20px',
        animation: 'slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Carte principale avec effet glassmorphism avancé */}
        <div style={{
          background: 'rgba(10, 16, 28, 0.85)',
          backdropFilter: 'blur(20px) saturate(180%)',
          borderRadius: '32px',
          border: '1px solid rgba(45, 139, 255, 0.25)',
          padding: '48px 40px',
          boxShadow: '0 40px 80px -20px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(45, 139, 255, 0.1) inset',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Décoration de coin */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '120px',
            height: '120px',
            background: 'linear-gradient(135deg, rgba(45, 139, 255, 0.15) 0%, transparent 70%)',
            borderRadius: '0 0 120px 0'
          }} />
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '120px',
            height: '120px',
            background: 'linear-gradient(315deg, rgba(45, 139, 255, 0.1) 0%, transparent 70%)',
            borderRadius: '120px 0 0 0'
          }} />

          {/* Logo avec animation */}
          <div style={{ textAlign: 'center', marginBottom: '40px', position: 'relative' }}>
            <div className="logo-container" style={{
              width: '100px',
              height: '100px',
              margin: '0 auto 20px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div className="logo-ring" />
              <div className="logo-glow" />
              <img 
                src="/onee_logo.png" 
                alt="ONEE Logo" 
                style={{
                  width: '70px',
                  height: '70px',
                  objectFit: 'contain',
                  position: 'relative',
                  zIndex: 2
                }}
              />
            </div>
            
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '10px',
              letterSpacing: '-0.02em'
            }}>
              ONEE <span style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>Predict</span>
            </h1>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <Droplets size={14} style={{ color: '#3b82f6' }} />
              <p style={{ color: '#94a3b8', fontSize: '14px', fontWeight: '500' }}>
                Système de Prédiction des Besoins en Eau Potable
              </p>
              <Sparkles size={14} style={{ color: '#f59e0b' }} />
            </div>
            
            <div className="divider" style={{
              width: '60px',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
              margin: '16px auto 0'
            }} />
          </div>

          {/* Message d'erreur avec animation */}
          {error && (
            <div className="error-message" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '14px',
              padding: '14px 18px',
              marginBottom: '28px',
              animation: 'shake 0.5s ease'
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                background: 'rgba(239, 68, 68, 0.2)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertCircle size={16} color="#ef4444" />
              </div>
              <span style={{ color: '#fca5a5', fontSize: '13px', fontWeight: '500' }}>{error}</span>
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit}>
            {/* Champ Email */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: focusedField === 'email' ? '#60a5fa' : '#64748b',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                transition: 'color 0.2s'
              }}>
                Email professionnel
              </label>
              <div className={`input-group ${focusedField === 'email' ? 'focused' : ''}`} style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.8)',
                border: `1.5px solid ${focusedField === 'email' ? '#3b82f6' : '#1e293b'}`,
                borderRadius: '16px',
                padding: '14px 18px',
                transition: 'all 0.2s'
              }}>
                <Mail size={18} color={focusedField === 'email' ? '#60a5fa' : '#64748b'} style={{ marginRight: '14px', transition: 'color 0.2s' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="admin@onee.com"
                  required
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '500',
                    fontFamily: "'Inter', sans-serif"
                  }}
                />
              </div>
            </div>

            {/* Champ Mot de passe */}
            <div style={{ marginBottom: '32px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: focusedField === 'password' ? '#60a5fa' : '#64748b',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                transition: 'color 0.2s'
              }}>
                Mot de passe
              </label>
              <div className={`input-group ${focusedField === 'password' ? 'focused' : ''}`} style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.8)',
                border: `1.5px solid ${focusedField === 'password' ? '#3b82f6' : '#1e293b'}`,
                borderRadius: '16px',
                padding: '14px 18px',
                transition: 'all 0.2s'
              }}>
                <Lock size={18} color={focusedField === 'password' ? '#60a5fa' : '#64748b'} style={{ marginRight: '14px', transition: 'color 0.2s' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  required
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '500',
                    fontFamily: "'Inter', sans-serif"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {showPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
                </button>
              </div>
            </div>

            {/* Bouton de connexion avec effet 3D */}
            <button
              type="submit"
              disabled={loading}
              className="login-btn"
              style={{
                width: '100%',
                padding: '16px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                borderRadius: '20px',
                color: 'white',
                fontWeight: '700',
                fontSize: '15px',
                letterSpacing: '0.5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: loading ? 0.7 : 1,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <span className="btn-glow" />
              {loading ? (
                <>
                  <div className="spinner" style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  Connexion en cours...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Se connecter
                  <Shield size={14} style={{ opacity: 0.7 }} />
                </>
              )}
            </button>
          </form>

          {/* Informations de test avec style moderne */}
          <div style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid rgba(45, 139, 255, 0.15)',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(45, 139, 255, 0.08)',
              padding: '8px 16px',
              borderRadius: '40px',
              marginBottom: '12px'
            }}>
              <Activity size={12} color="#3b82f6" />
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>COMPTE DE DÉMONSTRATION</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <code style={{
                background: 'rgba(45, 139, 255, 0.1)',
                padding: '8px 16px',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#60a5fa',
                fontFamily: "'Fira Code', monospace",
                fontWeight: '500'
              }}>
                 admin@onee.com
              </code>
              <span style={{ color: '#334155' }}>•</span>
              <code style={{
                background: 'rgba(45, 139, 255, 0.1)',
                padding: '8px 16px',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#60a5fa',
                fontFamily: "'Fira Code', monospace",
                fontWeight: '500'
              }}>
                 admin123
              </code>
            </div>
          </div>
        </div>

        {/* Footer élégant */}
        <div style={{
          textAlign: 'center',
          marginTop: '32px',
          fontSize: '11px',
          color: '#475569',
          fontWeight: '500',
          letterSpacing: '0.5px'
        }}>
          <span>© 2025 ONEE Predict</span>
          <span style={{ margin: '0 8px' }}>•</span>
          <span>Sécurité de niveau bancaire</span>
          <span style={{ margin: '0 8px' }}>•</span>
          <span>v3.0.1</span>
        </div>
      </div>

      <style>{`
        @keyframes slideUpFade {
          0% {
            opacity: 0;
            transform: translateY(40px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-10px) translateX(5px); }
          75% { transform: translateY(5px) translateX(-5px); }
        }

        .particles {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: 0;
        }

        .particle {
          position: absolute;
          width: 2px;
          height: 2px;
          background: rgba(59, 130, 246, 0.4);
          border-radius: 50%;
          animation: float linear infinite;
        }

        .grid-3d {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: 
            linear-gradient(rgba(59, 130, 246, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.05) 1px, transparent 1px);
          background-size: 50px 50px;
          transform: perspective(500px) rotateX(2deg);
          transform-origin: center top;
          z-index: 0;
        }

        .logo-container {
          position: relative;
        }

        .logo-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100px;
          height: 100px;
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 2s ease-in-out infinite;
        }

        .logo-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 80px;
          height: 80px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: glow 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.5;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 0.2;
          }
        }

        @keyframes glow {
          0%, 100% {
            opacity: 0.5;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
          }
        }

        .input-group {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .input-group:hover {
          border-color: #3b82f6 !important;
        }

        .login-btn {
          position: relative;
          overflow: hidden;
        }

        .btn-glow {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s;
        }

        .login-btn:hover .btn-glow {
          left: 100%;
        }

        .login-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px -5px rgba(59, 130, 246, 0.5);
        }

        .login-btn:active {
          transform: translateY(0);
        }

        .divider {
          animation: expandWidth 0.8s ease-out;
        }

        @keyframes expandWidth {
          from {
            width: 0;
            opacity: 0;
          }
          to {
            width: 60px;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;