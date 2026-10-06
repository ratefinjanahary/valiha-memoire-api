import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard JWT optionnel : décode le token si présent et peuple req.user,
 * mais n'échoue pas si le token est absent ou invalide.
 * Utilisé pour les endpoints publics qui adaptent leur réponse selon le rôle.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // Ne pas rejeter la requête si l'authentification échoue
  handleRequest(_err: any, user: any) {
    return user || null;
  }
}
