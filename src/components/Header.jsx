import './Header.css';

function ModeButton({setMode,mode,text,color='black'}){
    return(
        <button style={{ backgroundColor: color }} onClick={() => setMode(mode)}>{text}</button>
    );
}

function Header({setMode}) {
return (
    <header className="header">
            <div className="header-container">
                    <div className="logoa">Kpopdle</div>
                    <div className="header-buttons">
                            <ModeButton setMode={setMode} mode='All' text='All' />
                            <ModeButton setMode={setMode} mode='Girl Group' text='GG' color='pink'/>
                            <ModeButton setMode={setMode} mode='Boy Group' text='BG' color='lightblue'/>
                    </div>
            </div>
    </header>
);
}

export default Header;
