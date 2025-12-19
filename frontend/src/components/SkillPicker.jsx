import React, { useState, useEffect } from 'react';
import './SkillPicker.css';

/**
 * LLM Model Picker Component
 * Allows users to select the underlying LLM model for an agent
 * This is the agent's BRAIN — separate from skills and modules
 * 
 * Props:
 * - agentId: string (mei, oracle, etc.)
 * - agentName: string (display name)
 * - agentColor: string (CSS variable name like 'mei', 'hanna')
 * - userTier: string (free, pro, premium, platinum)
 * - currentSkillId: string | null (currently selected model ID)
 * - onSkillChange: function(modelId) (callback when selection changes)
 * - skills: array of model objects with { id, provider, name, description, tier }
 */
export function SkillPicker({
    agentId,
    agentName,
    agentColor = 'blue',
    userTier = 'free',
    currentSkillId = null,
    onSkillChange,
    skills = []
}) {
    const [selectedSkill, setSelectedSkill] = useState(currentSkillId);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        setSelectedSkill(currentSkillId);
    }, [currentSkillId]);

    const handleSkillSelect = (skillId) => {
        setSelectedSkill(skillId);
        if (onSkillChange) {
            onSkillChange(skillId);
        }
        setIsExpanded(false);
    };

    const handleReset = () => {
        setSelectedSkill(null);
        if (onSkillChange) {
            onSkillChange(null);
        }
    };

    const currentSkill = skills.find(s => s.id === selectedSkill);

    // Group models by PROVIDER (not tier) for better organization
    const providerGroups = {
        anthropic: skills.filter(s => s.provider === 'anthropic'),
        openai: skills.filter(s => s.provider === 'openai'),
        google: skills.filter(s => s.provider === 'google'),
        nvidia: skills.filter(s => s.provider === 'nvidia')
    };

    const providerLabels = {
        anthropic: { name: 'Anthropic', icon: '🔮' },
        openai: { name: 'OpenAI', icon: '🤖' },
        google: { name: 'Google', icon: '🌐' },
        nvidia: { name: 'NVIDIA / Open Models', icon: '🚀' }
    };

    return (
        <div className={`skill-picker skill-picker--${agentColor}`}>
            <div className="skill-picker__header">
                <div className="skill-picker__agent-info">
                    <span className="skill-picker__agent-name">{agentName}</span>
                    <span className="skill-picker__label">Brain / LLM Model</span>
                </div>
                <span className={`badge badge--${userTier}`}>{userTier}</span>
            </div>

            <button
                className="skill-picker__trigger"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="skill-picker__trigger-content">
                    {currentSkill ? (
                        <>
                            <span className="skill-picker__selected-name">{currentSkill.name}</span>
                            <span className="skill-picker__selected-model">{currentSkill.id}</span>
                        </>
                    ) : (
                        <>
                            <span className="skill-picker__placeholder">Oracle Default</span>
                            <span className="skill-picker__selected-model">Using Oracle's recommended model</span>
                        </>
                    )}
                </div>
                <span className={`skill-picker__chevron ${isExpanded ? 'skill-picker__chevron--up' : ''}`}>▼</span>
            </button>

            {isExpanded && (
                <div className="skill-picker__dropdown">
                    {/* Reset option */}
                    <button
                        className={`skill-picker__option ${!selectedSkill ? 'skill-picker__option--selected' : ''}`}
                        onClick={handleReset}
                    >
                        <div className="skill-picker__option-content">
                            <span className="skill-picker__option-name">🎯 Oracle Default</span>
                            <span className="skill-picker__option-desc">Let Oracle choose the best model for {agentName}</span>
                        </div>
                    </button>

                    {/* Provider groups */}
                    {Object.entries(providerGroups).map(([providerId, models]) => (
                        models.length > 0 && (
                            <div key={providerId} className="skill-picker__group">
                                <div className="skill-picker__group-header">
                                    <span className="skill-picker__provider-label">
                                        {providerLabels[providerId]?.icon} {providerLabels[providerId]?.name}
                                    </span>
                                </div>
                                {models.map(model => (
                                    <ModelOption
                                        key={model.id}
                                        model={model}
                                        isSelected={selectedSkill === model.id}
                                        onSelect={handleSkillSelect}
                                        userTier={userTier}
                                    />
                                ))}
                            </div>
                        )
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Individual model option in the dropdown
 */
function ModelOption({ model, isSelected, onSelect, userTier }) {
    const tierHierarchy = { free: 0, pro: 1, premium: 2, platinum: 3 };
    const modelTierLevel = tierHierarchy[model.tier] || 0;
    const userTierLevel = tierHierarchy[userTier] || 0;
    const hasAccess = userTierLevel >= modelTierLevel;

    return (
        <button
            className={`skill-picker__option ${isSelected ? 'skill-picker__option--selected' : ''} ${!hasAccess ? 'skill-picker__option--locked' : ''}`}
            onClick={() => hasAccess && onSelect(model.id)}
            disabled={!hasAccess}
        >
            <div className="skill-picker__option-content">
                <div className="skill-picker__option-header">
                    <span className="skill-picker__option-name">
                        {model.name}
                        {model.thinkingMode && <span className="skill-picker__badge">🧠 Thinking</span>}
                        {model.multimodal && <span className="skill-picker__badge">👁️ Vision</span>}
                    </span>
                    <span className={`badge badge--${model.tier}`}>{model.tier}</span>
                </div>
                <span className="skill-picker__option-desc">{model.description}</span>
                <span className="skill-picker__option-model">{model.id}</span>
            </div>
            {isSelected && <span className="skill-picker__check">✓</span>}
            {!hasAccess && <span className="skill-picker__lock">🔒</span>}
        </button>
    );
}

export default SkillPicker;

