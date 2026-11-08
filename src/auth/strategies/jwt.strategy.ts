import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const s = process.env.JWT_SECRET;
        if (!s) throw new Error('JWT_SECRET manquant');
        return s;
      })(),
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActif) {
      throw new UnauthorizedException('Utilisateur inactif ou non trouvé');
    }

    // Invalide les JWT émis avant le dernier reset de mot de passe.
    // `iat` est en secondes : on compare en secondes pour ne pas rejeter
    // à tort un token émis dans la même seconde que le changement.
    if (
      user.passwordChangedAt &&
      payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      throw new UnauthorizedException('Session expirée');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}