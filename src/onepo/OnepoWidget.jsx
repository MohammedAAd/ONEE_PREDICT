// onepo/OnepoWidget.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Brain, Send, X, Minimize2, Maximize2, Download, Sparkles, Zap, MessageSquare } from 'lucide-react';
import Markdown from 'react-markdown';
import { useOnepo } from './OnepoProvider';
import { envoyerMessage, genId } from './onepoService';

const PAGE_LABELS = { 
  dashboard: 'Tableau de bord', 
  consommation: 'Consommation',
  production: 'Production', 
  bilan: 'Bilan', 
  manquant: 'Données manquantes',
  architecture: 'Architecture', 
  scenarios: 'Scénarios', 
  prediction: 'Prédiction',
  prediction_y: 'Prédiction Y', 
  tables: 'Tables', 
  users: 'Utilisateurs' 
};

const SUGGESTIONS_INIT = [
  'Que montre cet écran ?',
  'Quels centres sont à risque ?',
  'Explique-moi cette prévision',
  'Quelles décisions recommandes-tu ?'
];

export default function OnepoWidget() {
  const { activePage, screen } = useOnepo();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([{
    role: 'ai',
    text: "Bonjour, je suis **ONEPO AI**, votre copilote décisionnel.\n\nJe vois en temps réel l'écran que vous consultez — posez-moi une question sur vos prévisions, les centres à risque ou les décisions à prendre.",
    suggestions: SUGGESTIONS_INIT,
    actions: [],
  }]);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const convId = useRef(genId());

  const context = { 
    page: PAGE_LABELS[activePage] || activePage || 'Plateforme',
    pageId: activePage, 
    ...screen 
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending]);

  useEffect(() => {
    if (open && !minimized && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open, minimized]);

  async function sendMessage(texte) {
    const msg = (texte || input).trim();
    if (!msg || sending) return;
    
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setSending(true);
    
    try {
      const res = await envoyerMessage({ 
        message: msg, 
        context, 
        conversationId: convId.current 
      });
      
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: res.reply || "Je n'ai pas pu traiter votre demande. Veuillez réessayer.",
        suggestions: res.suggestions || [], 
        actions: res.actions || [] 
      }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: "Désolé, une erreur technique s'est produite. Veuillez réessayer dans quelques instants.",
        suggestions: SUGGESTIONS_INIT,
        actions: [] 
      }]);
    } finally {
      setSending(false);
    }
  }

  function exportConversation() {
    const txt = messages.map(m =>
      (m.role === 'user' ? '## 👤 Vous\n' : '## 🤖 ONEPO AI\n') + m.text
    ).join('\n\n');
    const blob = new Blob(['# Conversation ONEPO AI\n\n' + txt], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `onepo-conversation-${new Date().toISOString().slice(0, 19)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleOpen() {
    setOpen(true);
    setMinimized(false);
  }

  function handleMinimize() {
    setMinimized(!minimized);
  }

  function handleClose() {
    setOpen(false);
    setMinimized(false);
  }

  const lastMessage = messages[messages.length - 1];
  const showExtras = !sending && lastMessage && lastMessage.role === 'ai';
  const suggestions = showExtras ? (lastMessage.suggestions || []) : [];
  const actions = showExtras ? (lastMessage.actions || []) : [];

  return (
    <>
      <style>{`
        .onepo-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 18px;
          border: none;
          cursor: pointer;
          z-index: 1000;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .onepo-fab:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 12px 32px rgba(59, 130, 246, 0.5);
        }

        .fab-ring {
          position: absolute;
          top: -4px;
          left: -4px;
          right: -4px;
          bottom: -4px;
          border-radius: 22px;
          border: 2px solid #3b82f6;
          animation: ring-pulse 2s ease-out infinite;
        }

        @keyframes ring-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          70% { transform: scale(1.3); opacity: 0; }
          100% { opacity: 0; }
        }

        .fab-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 18px;
          height: 18px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .onepo-widget {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 420px;
          max-width: calc(100vw - 48px);
          background: #ffffff;
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          z-index: 1001;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transform: translateY(20px);
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid #e2e8f0;
        }

        .onepo-widget.open {
          transform: translateY(0);
          opacity: 1;
          visibility: visible;
        }

        .onepo-widget.minimized {
          height: auto;
        }

        .onepo-widget.minimized .widget-header {
          border-bottom: none;
        }

        .widget-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
          border-bottom: 1px solid #e2e8f0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-icon {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .header-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: #1e293b;
        }

        .header-title span {
          color: #3b82f6;
        }

        .header-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.65rem;
          color: #64748b;
          margin-top: 2px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 6px #10b981;
          animation: dot-pulse 1.5s ease-in-out infinite;
        }

        @keyframes dot-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        .header-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #64748b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .header-btn:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .close-btn:hover {
          background: #fef2f2;
          color: #ef4444;
          border-color: #fecaca;
        }

        .widget-context {
          padding: 12px 20px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .context-label {
          font-size: 0.6rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #94a3b8;
          letter-spacing: 0.5px;
          display: block;
          margin-bottom: 8px;
        }

        .context-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .context-chip {
          font-size: 0.7rem;
          padding: 4px 12px;
          background: #eef2ff;
          color: #3b82f6;
          border-radius: 20px;
          font-weight: 500;
        }

        .widget-messages {
          flex: 1;
          max-height: 400px;
          overflow-y: auto;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #ffffff;
        }

        .widget-messages::-webkit-scrollbar {
          width: 4px;
        }

        .widget-messages::-webkit-scrollbar-track {
          background: #f1f5f9;
        }

        .widget-messages::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }

        .message {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          animation: slideIn 0.3s ease;
        }

        .message.user {
          flex-direction: row-reverse;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .message-avatar {
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }

        .message-bubble {
          max-width: 78%;
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 0.8rem;
          line-height: 1.55;
        }

        .message.ai .message-bubble {
          background: #f1f5f9;
          color: #1e293b;
          border-bottom-left-radius: 4px;
        }

        .message.user .message-bubble {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .message-bubble p {
          margin: 0 0 8px;
        }

        .message-bubble p:last-child {
          margin-bottom: 0;
        }

        .message-bubble ul, .message-bubble ol {
          margin: 6px 0;
          padding-left: 20px;
        }

        .message-bubble code {
          background: rgba(0, 0, 0, 0.05);
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 0.75rem;
        }

        .typing {
          display: flex;
          gap: 4px;
          align-items: center;
          padding: 12px 16px;
        }

        .typing span {
          width: 6px;
          height: 6px;
          background: #94a3b8;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out;
        }

        .typing span:nth-child(2) { animation-delay: 0.2s; }
        .typing span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }

        .widget-actions {
          padding: 8px 20px 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border: none;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 500;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
        }

        .widget-suggestions {
          padding: 8px 20px 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }

        .suggestion-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          font-size: 0.7rem;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .suggestion-btn:hover {
          border-color: #3b82f6;
          color: #3b82f6;
          background: #eef2ff;
          transform: translateX(2px);
        }

        .widget-input {
          display: flex;
          gap: 10px;
          padding: 16px 20px;
          border-top: 1px solid #e2e8f0;
          background: white;
        }

        .widget-input textarea {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          font-size: 0.8rem;
          font-family: inherit;
          resize: none;
          background: #f8fafc;
          color: #1e293b;
          transition: all 0.2s;
          max-height: 80px;
        }

        .widget-input textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .send-btn {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          border: none;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .send-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      {!open && (
        <button className="onepo-fab" onClick={handleOpen}>
          <div className="fab-ring" />
          <Brain size={24} />
          <div className="fab-badge">
            <Sparkles size={10} />
          </div>
        </button>
      )}

      <div className={`onepo-widget ${open ? 'open' : ''} ${minimized ? 'minimized' : ''}`}>
        <div className="widget-header">
          <div className="header-left">
            <div className="header-icon">
              <Brain size={20} />
            </div>
            <div>
              <div className="header-title">
                ONEPO <span>AI</span>
              </div>
              <div className="header-status">
                <span className="status-dot" />
                Copilote décisionnel
              </div>
            </div>
          </div>
          <div className="header-actions">
            <button onClick={exportConversation} className="header-btn" title="Exporter">
              <Download size={16} />
            </button>
            <button onClick={handleMinimize} className="header-btn" title={minimized ? 'Agrandir' : 'Réduire'}>
              {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
            <button onClick={handleClose} className="header-btn close-btn" title="Fermer">
              <X size={16} />
            </button>
          </div>
        </div>

        {!minimized && (
          <>
            <div className="widget-context">
              <span className="context-label">Contexte actuel</span>
              <div className="context-chips">
                <span className="context-chip">{context.page}</span>
                {context.region && <span className="context-chip">{context.region}</span>}
                {(context.centreLabel || context.centre) && 
                  <span className="context-chip">{context.centreLabel || context.centre}</span>}
                {context.cible && <span className="context-chip">{context.cible}</span>}
              </div>
            </div>

            <div className="widget-messages">
              {messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  {msg.role === 'ai' && (
                    <div className="message-avatar">
                      <Brain size={14} />
                    </div>
                  )}
                  <div className="message-bubble">
                    {msg.role === 'ai' ? <Markdown>{msg.text}</Markdown> : msg.text}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="message ai">
                  <div className="message-avatar">
                    <Brain size={14} />
                  </div>
                  <div className="message-bubble typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {actions.length > 0 && (
              <div className="widget-actions">
                {actions.map((action, idx) => (
                  <button key={idx} className="action-btn" onClick={() => sendMessage(action.prompt || action.label)}>
                    <Zap size={12} />
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="widget-suggestions">
                {suggestions.map((suggestion, idx) => (
                  <button key={idx} className="suggestion-btn" onClick={() => sendMessage(suggestion)}>
                    <MessageSquare size={12} />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <div className="widget-input">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Posez votre question…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button 
                className="send-btn" 
                onClick={() => sendMessage()}
                disabled={sending || !input.trim()}
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}