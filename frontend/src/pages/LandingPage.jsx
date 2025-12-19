import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import '../styles/landing.css'

function LandingPage() {
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 60000) // Update every minute
        return () => clearInterval(timer)
    }, [])

    const formatDateTime = (date) => {
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const year = date.getFullYear()
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${month}/${day}/${year} ${hours}${minutes}`
    }

    return (
        <div className="landing-page">
            {/* Background effects */}
            <div className="landing-bg">
                <div className="landing-bg__orb landing-bg__orb--1"></div>
                <div className="landing-bg__orb landing-bg__orb--2"></div>
            </div>

            {/* Main content */}
            <div className="landing-content">
                <h1 className="landing-logo">DeepFish</h1>

                <p className="landing-headline">START YOUR OWN DESIGN FIRM</p>

                <p className="landing-tagline">
                    A multi-agent AI system built for excellence and speed. Your dedicated team of
                    specialists is waiting in the boardroom.
                </p>

                <Link to="/app" className="landing-cta">
                    ENTER STUDIO
                </Link>

                <div className="landing-status">
                    SYSTEM STATUS: <span className="landing-status__online">ONLINE</span> • v1.0.0 • {formatDateTime(currentTime)}
                </div>
            </div>
        </div>
    )
}

export default LandingPage
