import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './AgentContextMenu.css';

/**
 * Agent Context Menu Component
 * Right-click menu for agent-related quick actions
 * 
 * Usage: Wrap agent elements with this component
 * <AgentContextMenu agentId="mei" agentName="Mei">
 *     <div className="agent-card">...</div>
 * </AgentContextMenu>
 */
export function AgentContextMenu({ children, agentId, agentName }) {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
        setPosition({ x: e.clientX, y: e.clientY });
        setIsOpen(true);
    }, []);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    // Close menu on escape or click outside
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') handleClose();
        };
        const handleClick = () => handleClose();

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.addEventListener('click', handleClick);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('click', handleClick);
        };
    }, [isOpen, handleClose]);

    const menuItems = [
        {
            icon: '⚙️',
            label: 'Agent Dashboard',
            action: () => navigate(`/agents/${agentId}`)
        },
        {
            icon: '💬',
            label: `Chat with ${agentName}`,
            action: () => navigate(`/chat/${agentId}`)
        },
        { divider: true },
        {
            icon: '🧠',
            label: 'Change LLM',
            action: () => navigate(`/agents/${agentId}#llm`)
        },
        {
            icon: '🎤',
            label: 'Change Voice',
            action: () => navigate(`/agents/${agentId}#voice`)
        },
        {
            icon: '🎭',
            label: 'Change Skin',
            action: () => navigate(`/agents/${agentId}#skins`)
        },
        { divider: true },
        {
            icon: '📚',
            label: 'Training',
            action: () => navigate(`/agents/${agentId}#training`)
        }
    ];

    return (
        <div onContextMenu={handleContextMenu} style={{ display: 'contents' }}>
            {children}

            {isOpen && (
                <div
                    className="context-menu"
                    style={{
                        left: position.x,
                        top: position.y
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="context-menu__header">
                        <span className="context-menu__agent-name">{agentName}</span>
                    </div>
                    {menuItems.map((item, index) => (
                        item.divider ? (
                            <div key={index} className="context-menu__divider" />
                        ) : (
                            <button
                                key={index}
                                className="context-menu__item"
                                onClick={() => {
                                    item.action();
                                    handleClose();
                                }}
                            >
                                <span className="context-menu__icon">{item.icon}</span>
                                <span className="context-menu__label">{item.label}</span>
                            </button>
                        )
                    ))}
                </div>
            )}
        </div>
    );
}

export default AgentContextMenu;
