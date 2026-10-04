import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Settings from './pages/Settings'

export default function EtApp() {
  return (
    <div className="min-h-full min-h-[100dvh] flex flex-col max-w-xl mx-auto bg-[#faf7f5] dark:bg-[#141211]">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ayarlar" element={<Settings />} />
      </Routes>
    </div>
  )
}
