import { Navigate, useParams } from 'react-router-dom'
import { gameById } from '../lib/games'
import GameShell from '../components/GameShell'
import HafizaKartlari from '../games/HafizaKartlari'
import SiraTakibi from '../games/SiraTakibi'
import RenkTuzagi from '../games/RenkTuzagi'
import SayiAvi from '../games/SayiAvi'
import KarisikHarfler from '../games/KarisikHarfler'
import ZihindenHesap from '../games/ZihindenHesap'
import KelimeleriHatirla from '../games/KelimeleriHatirla'
import FarkliOlan from '../games/FarkliOlan'

// /oyna/:id -> ilgili oyunu ortak sarmalayici icinde acar
export default function Play() {
  const { id } = useParams()
  const game = gameById(id)
  if (!game) return <Navigate to="/" replace />

  return (
    <GameShell
      key={game.id}
      game={game}
      render={(level, finish) => {
        switch (game.id) {
          case 'hafiza':
            return <HafizaKartlari level={level} onFinish={finish} />
          case 'sira':
            return <SiraTakibi level={level} onFinish={finish} />
          case 'renk':
            return <RenkTuzagi level={level} onFinish={finish} />
          case 'sayi':
            return <SayiAvi level={level} onFinish={finish} />
          case 'harf':
            return <KarisikHarfler level={level} onFinish={finish} />
          case 'hesap':
            return <ZihindenHesap level={level} onFinish={finish} />
          case 'kelime':
            return <KelimeleriHatirla level={level} onFinish={finish} />
          case 'farkli':
            return <FarkliOlan level={level} onFinish={finish} />
          default:
            return null
        }
      }}
    />
  )
}
