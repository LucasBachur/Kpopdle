import { useState } from 'react';
import './ModeSelector.css';

function ModeSelector({ setMode, currentMode }) {
    const [hovered, setHovered] = useState(false);

    const modes = [
        { mode: 'Boy Group', text: 'BG', color: 'lightblue' },
        { mode: 'Girl Group', text: 'GG', color: 'pink' },
        { mode: 'All', text: 'All', color: '#555' }
    ];
    const sortedModes = [
        ...modes.filter(m => m.mode !== currentMode),
        modes.find(m => m.mode === currentMode)
    ];


return (
    <div
        className="mode-container"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
    >
        <div className="mode-inner">
            {sortedModes.map((m) => (
                <button
                    key={m.mode}
                    className={`mode-button ${m.mode === currentMode ? 'active' : ''} ${hovered ? 'visible' : 'hidden'}`}
                    style={{ backgroundColor: m.color }}
                    onClick={() => {
                        setMode(m.mode);
                        setHovered(false);
                    }}
                >
                    <div className="button-main-text">{m.text}</div>
                    {(m.mode === 'Boy Group' || m.mode === 'Girl Group') && (
                        <div className="button-subtext">{m.mode}</div>
                    )}
                </button>
            ))}
        </div>
    </div>
);
}

export default ModeSelector;
