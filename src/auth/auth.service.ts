import { BadRequestException, Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcryptjs';
import { Role } from './role.enum.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UpdateProfileInput } from './dto/update-profile.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../common/audit.actions.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async register(data: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Par défaut, l'utilisateur est PUBLIC ou ETUDIANT
    const roleToAssign = data.role === Role.ETUDIANT ? Role.ETUDIANT : Role.PUBLIC;

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: hashedPassword,
        nom: data.nom,
        prenom: data.prenom,
        role: roleToAssign,
      },
    });

    // Audit : inscription
    this.auditService.log(AuditAction.REGISTER, user.id, `email:${user.email}`);

    return this.generateToken(user);
  }

  async login(data: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || !user.isActif) {
      throw new UnauthorizedException('Identifiants invalides ou compte inactif');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Audit : connexion réussie
    this.auditService.log(AuditAction.LOGIN, user.id, `email:${user.email}`);

    return this.generateToken(user);
  }

  private generateToken(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
      },
    };
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        isActif: true,
        createdAt: true,
      },
    });
  }

  async getUsers(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          role: true,
          isActif: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateUserRole(id: string, role: Role, adminId: string) {
    const userExists = await this.prisma.user.findUnique({ where: { id } });
    if (!userExists) {
      throw new ConflictException("L'utilisateur n'existe pas");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role },
    });

    this.auditService.log(
      AuditAction.UPDATE_ROLE,
      adminId,
      `role_updated_for:${updatedUser.email}_to:${role}`,
    );

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      nom: updatedUser.nom,
      prenom: updatedUser.prenom,
      role: updatedUser.role,
    };
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActif) {
      throw new UnauthorizedException('Compte introuvable ou inactif');
    }

    const updateData: {
      nom?: string;
      prenom?: string;
      email?: string;
      passwordHash?: string;
    } = {};

    if (data.nom && data.nom !== user.nom) updateData.nom = data.nom;
    if (data.prenom && data.prenom !== user.prenom) updateData.prenom = data.prenom;

    const emailChanged = !!data.email && data.email !== user.email;
    const passwordChanged = !!data.newPassword;

    // Re-vérification du mot de passe pour les changements sensibles
    if (emailChanged || passwordChanged) {
      const isValid =
        !!data.currentPassword &&
        (await bcrypt.compare(data.currentPassword, user.passwordHash));
      if (!isValid) {
        // 400 et non 401 : évite que l'intercepteur axios déconnecte l'utilisateur
        throw new BadRequestException('Mot de passe actuel incorrect');
      }
    }

    if (emailChanged) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: data.email! },
      });
      if (emailTaken) throw new ConflictException('Cet email est déjà utilisé');
      updateData.email = data.email!;
    }

    if (passwordChanged) {
      updateData.passwordHash = await bcrypt.hash(data.newPassword!, 10);
    }

    // Rien n'a réellement changé
    if (Object.keys(updateData).length === 0) {
      return this.generateToken(user);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const fields = Object.keys(updateData).map((k) => (k === 'passwordHash' ? 'password' : k));
    this.auditService.log(
      AuditAction.UPDATE_PROFILE,
      userId,
      `profile_updated_fields:${fields.join(',')}`,
    );

    // Nouveau token : le payload JWT contient l'email, qui a pu changer
    return this.generateToken(updatedUser);
  }

  async deleteUser(id: string, requesterId: string, isAdmin: boolean) {
    const userExists = await this.prisma.user.findUnique({ where: { id } });
    if (!userExists) {
      throw new ConflictException("L'utilisateur n'existe pas");
    }

    // Seul un admin ou l'utilisateur lui-même peut supprimer le compte
    if (!isAdmin && requesterId !== id) {
      throw new UnauthorizedException("Vous n'êtes pas autorisé à supprimer ce compte");
    }

    await this.prisma.user.delete({
      where: { id },
    });

    this.auditService.log(
      AuditAction.DELETE_USER,
      requesterId,
      `user_deleted_id:${id}_email:${userExists.email}_by:${isAdmin ? 'ADMIN' : 'SELF'}`,
    );

    return { success: true, message: 'Utilisateur supprimé avec succès' };
  }
}
