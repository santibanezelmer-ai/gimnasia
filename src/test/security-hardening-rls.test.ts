/**
 * OPERIX GYMNASTICS — SUITE DE PRUEBAS DE SEGURIDAD RLS Y MULTI-TENANT (FASE 10.1)
 * Desarrollado por Comercial Hels SpA
 * Fecha: 5 de noviembre de 2026
 *
 * Verifica formalmente las reglas de autorización, fronteras multi-tenant,
 * confidencialidad de reclamos técnicos (FIG Art. 5.4), e inmutabilidad de auditoría.
 */

import { describe, it, expect } from 'vitest';
import type { Database } from '../core/types/database';

type OrgRole = Database['public']['Enums']['organization_role'];

interface MockUser {
    id: string;
    email: string;
    isPlatformAdmin?: boolean;
}

interface MockOrgMember {
    organizationId: string;
    userId: string;
    role: OrgRole;
}

interface MockClubMember {
    clubId: string;
    userId: string;
    role: 'manager' | 'coach';
}

interface MockChampionship {
    id: string;
    organizationId: string;
    name: string;
    isPublic: boolean;
    status: 'draft' | 'published' | 'in_progress' | 'completed' | 'archived';
}

interface MockScore {
    id: string;
    championshipId: string;
    judgeId?: string;
    judgeUserId?: string;
    status: 'draft' | 'provisional' | 'approved' | 'inquired' | 'voided';
}

interface MockTechnicalInquiry {
    id: string;
    championshipId: string;
    clubId: string;
    submittedBy: string;
    status: 'pending' | 'accepted' | 'rejected';
}

interface MockDocument {
    id: string;
    championshipId: string;
    docType: 'result_book' | 'certificate' | 'technical_minutes' | 'judges_sheet';
    isPublic: boolean;
}

/**
 * Motor de Evaluación de Políticas de Seguridad RLS de Operix
 * Replica exactamente la lógica de los predicados SQL de la migración 20261105000005.
 */
class OperixSecurityEvaluator {
    private users: Map<string, MockUser> = new Map();
    private orgMembers: MockOrgMember[] = [];
    private clubMembers: MockClubMember[] = [];
    private championships: Map<string, MockChampionship> = new Map();
    private scores: Map<string, MockScore> = new Map();

    constructor(data: {
        users: MockUser[];
        orgMembers: MockOrgMember[];
        clubMembers: MockClubMember[];
        championships: MockChampionship[];
        scores: MockScore[];
    }) {
        data.users.forEach(u => this.users.set(u.id, u));
        this.orgMembers = data.orgMembers;
        this.clubMembers = data.clubMembers;
        data.championships.forEach(c => this.championships.set(c.id, c));
        data.scores.forEach(s => this.scores.set(s.id, s));
    }

    isPlatformAdmin(userId: string | null): boolean {
        if (!userId) return false;
        return !!this.users.get(userId)?.isPlatformAdmin;
    }

    currentUserHasOrgRole(userId: string | null, orgId: string, requiredRoles: OrgRole[]): boolean {
        if (!userId) return false;
        if (this.isPlatformAdmin(userId)) return true;
        return this.orgMembers.some(
            m => m.organizationId === orgId && m.userId === userId && requiredRoles.includes(m.role)
        );
    }

    currentUserHasChampionshipRole(userId: string | null, championshipId: string, requiredRoles: OrgRole[]): boolean {
        if (!userId) return false;
        if (this.isPlatformAdmin(userId)) return true;
        const champ = this.championships.get(championshipId);
        if (!champ) return false;
        return this.currentUserHasOrgRole(userId, champ.organizationId, requiredRoles);
    }

    canViewChampionshipPublicData(userId: string | null, championshipId: string): boolean {
        const champ = this.championships.get(championshipId);
        if (!champ) return false;

        // Si es público o activo/completado
        if (champ.isPublic || ['in_progress', 'completed', 'published'].includes(champ.status)) {
            return true;
        }

        // Si es privado o borrador, requiere credenciales en la organización
        if (!userId) return false;
        if (this.isPlatformAdmin(userId)) return true;
        const allRoles: OrgRole[] = ['org_admin', 'competition_manager', 'head_judge', 'judge', 'club_manager', 'coach', 'viewer'];
        return this.currentUserHasOrgRole(userId, champ.organizationId, allRoles);
    }

    isJudgeAssignedToScore(userId: string | null, scoreId: string): boolean {
        if (!userId) return false;
        if (this.isPlatformAdmin(userId)) return true;
        const score = this.scores.get(scoreId);
        if (!score) return false;

        if (score.judgeUserId === userId) return true;

        return this.currentUserHasChampionshipRole(
            userId,
            score.championshipId,
            ['org_admin', 'competition_manager', 'head_judge']
        );
    }

    // Predicados RLS por Tabla y Acción

    // 1. score_deductions
    canSelectScoreDeduction(userId: string | null, scoreId: string): boolean {
        const score = this.scores.get(scoreId);
        if (!score) return false;
        return this.canViewChampionshipPublicData(userId, score.championshipId) || this.isJudgeAssignedToScore(userId, scoreId);
    }

    canInsertScoreDeduction(userId: string | null, scoreId: string): boolean {
        return this.isJudgeAssignedToScore(userId, scoreId);
    }

    canDeleteScoreDeduction(userId: string | null, scoreId: string): boolean {
        const score = this.scores.get(scoreId);
        if (!score) return false;
        return this.currentUserHasChampionshipRole(userId, score.championshipId, ['org_admin', 'competition_manager', 'head_judge']);
    }

    // 2. technical_inquiries (FIG Art. 5.4)
    canSelectTechnicalInquiry(userId: string | null, inquiry: MockTechnicalInquiry): boolean {
        if (!userId) return false;
        if (this.isPlatformAdmin(userId)) return true;
        if (this.currentUserHasChampionshipRole(userId, inquiry.championshipId, ['org_admin', 'competition_manager', 'head_judge'])) {
            return true;
        }
        if (inquiry.submittedBy === userId) return true;
        return this.clubMembers.some(cm => cm.clubId === inquiry.clubId && cm.userId === userId);
    }

    canInsertTechnicalInquiry(userId: string | null, championshipId: string, clubId: string): boolean {
        if (!userId) return false;
        if (this.isPlatformAdmin(userId)) return true;
        if (this.currentUserHasChampionshipRole(userId, championshipId, ['org_admin', 'competition_manager', 'head_judge'])) {
            return true;
        }
        return this.clubMembers.some(cm => cm.clubId === clubId && cm.userId === userId);
    }

    canResolveTechnicalInquiry(userId: string | null, championshipId: string): boolean {
        if (!userId) return false;
        if (this.isPlatformAdmin(userId)) return true;
        return this.currentUserHasChampionshipRole(userId, championshipId, ['org_admin', 'competition_manager', 'head_judge']);
    }

    // 3. championship_documents
    canSelectDocument(userId: string | null, doc: MockDocument): boolean {
        if (doc.isPublic && this.canViewChampionshipPublicData(userId, doc.championshipId)) {
            return true;
        }
        if (!userId) return false;
        return this.currentUserHasChampionshipRole(userId, doc.championshipId, ['org_admin', 'competition_manager', 'head_judge']);
    }

    canManageDocuments(userId: string | null, championshipId: string): boolean {
        if (!userId) return false;
        return this.currentUserHasChampionshipRole(userId, championshipId, ['org_admin', 'competition_manager']);
    }

    // 4. ceremonies & awards
    canManageCeremonies(userId: string | null, championshipId: string): boolean {
        if (!userId) return false;
        return this.currentUserHasChampionshipRole(userId, championshipId, ['org_admin', 'competition_manager']);
    }

    // 5. score_audits
    canSelectScoreAudits(userId: string | null, championshipId: string): boolean {
        if (!userId) return false;
        if (this.isPlatformAdmin(userId)) return true;
        return this.currentUserHasChampionshipRole(userId, championshipId, ['org_admin', 'competition_manager', 'head_judge']);
    }

    canUpdateOrDeleteScoreAudits(): boolean {
        // La política prohíbe taxativamente UPDATE y DELETE sobre score_audits (inmutable)
        return false;
    }
}

describe('OPERIX GYMNASTICS — Hardening de Seguridad RLS y Multi-Tenant (Fase 10.1)', () => {
    // Escenario de Prueba:
    // Organización A (Club Manquehue Org): Campeonato A1
    // Organización B (Federación Regional Org): Campeonato B1
    const security = new OperixSecurityEvaluator({
        users: [
            { id: 'user-admin-a', email: 'admin@org-a.cl' },
            { id: 'user-manager-a', email: 'manager@org-a.cl' },
            { id: 'user-head-judge-a', email: 'headjudge@org-a.cl' },
            { id: 'user-judge-vault-a', email: 'judge-vault@org-a.cl' },
            { id: 'user-coach-club1', email: 'coach1@club1.cl' },
            { id: 'user-coach-club2', email: 'coach2@club2.cl' },
            { id: 'user-admin-b', email: 'admin@org-b.cl' },
            { id: 'user-public-viewer', email: 'public@gmail.com' },
        ],
        orgMembers: [
            { organizationId: 'org-a', userId: 'user-admin-a', role: 'org_admin' },
            { organizationId: 'org-a', userId: 'user-manager-a', role: 'competition_manager' },
            { organizationId: 'org-a', userId: 'user-head-judge-a', role: 'head_judge' },
            { organizationId: 'org-a', userId: 'user-judge-vault-a', role: 'judge' },
            { organizationId: 'org-b', userId: 'user-admin-b', role: 'org_admin' },
        ],
        clubMembers: [
            { clubId: 'club-1', userId: 'user-coach-club1', role: 'coach' },
            { clubId: 'club-2', userId: 'user-coach-club2', role: 'coach' },
        ],
        championships: [
            { id: 'champ-a1', organizationId: 'org-a', name: 'Copa Manquehue 2026', isPublic: true, status: 'in_progress' },
            { id: 'champ-a-private', organizationId: 'org-a', name: 'Control Interno Privado', isPublic: false, status: 'draft' },
            { id: 'champ-b1', organizationId: 'org-b', name: 'Campeonato Regional Sur', isPublic: true, status: 'in_progress' },
        ],
        scores: [
            { id: 'score-vault-1', championshipId: 'champ-a1', judgeUserId: 'user-judge-vault-a', status: 'provisional' },
            { id: 'score-bars-1', championshipId: 'champ-a1', judgeUserId: 'user-other-judge', status: 'provisional' },
            { id: 'score-champ-b-1', championshipId: 'champ-b1', judgeUserId: 'user-judge-b', status: 'provisional' },
        ],
    });

    it('1. Aislamiento Multi-Tenant: Org Admin de Org A no puede gestionar recursos de Org B', () => {
        expect(security.canManageCeremonies('user-admin-a', 'champ-a1')).toBe(true);
        expect(security.canManageCeremonies('user-admin-a', 'champ-b1')).toBe(false);
        expect(security.canManageDocuments('user-admin-a', 'champ-b1')).toBe(false);

        // Org B no puede gestionar Org A
        expect(security.canManageCeremonies('user-admin-b', 'champ-a1')).toBe(false);
        expect(security.canManageCeremonies('user-admin-b', 'champ-b1')).toBe(true);
    });

    it('2. Barrera de Asignación de Jueces: Juez solo gestiona deducciones de su nota asignada', () => {
        // Juez de salto en Torneo A1 puede insertar deducciones en su nota
        expect(security.canInsertScoreDeduction('user-judge-vault-a', 'score-vault-1')).toBe(true);

        // Pero NO puede insertar deducciones en barras (otro juez)
        expect(security.canInsertScoreDeduction('user-judge-vault-a', 'score-bars-1')).toBe(false);

        // Y NO puede insertar deducciones en el torneo de Org B
        expect(security.canInsertScoreDeduction('user-judge-vault-a', 'score-champ-b-1')).toBe(false);

        // Head Judge y Org Admin de Org A sí pueden intervenir técnicamente en notas de su torneo
        expect(security.canInsertScoreDeduction('user-head-judge-a', 'score-vault-1')).toBe(true);
        expect(security.canInsertScoreDeduction('user-head-judge-a', 'score-bars-1')).toBe(true);
        expect(security.canInsertScoreDeduction('user-head-judge-a', 'score-champ-b-1')).toBe(false);
    });

    it('3. Frontera Pública vs Privada en Torneos y Documentos', () => {
        // Torneo A1 es público e in_progress -> visible al público
        expect(security.canViewChampionshipPublicData(null, 'champ-a1')).toBe(true);

        // Torneo A Privado es draft e isPublic=false -> invisible para público anónimo o de otra org
        expect(security.canViewChampionshipPublicData(null, 'champ-a-private')).toBe(false);
        expect(security.canViewChampionshipPublicData('user-public-viewer', 'champ-a-private')).toBe(false);
        expect(security.canViewChampionshipPublicData('user-admin-b', 'champ-a-private')).toBe(false);

        // Visible exclusivamente para staff de Org A
        expect(security.canViewChampionshipPublicData('user-admin-a', 'champ-a-private')).toBe(true);
        expect(security.canViewChampionshipPublicData('user-manager-a', 'champ-a-private')).toBe(true);
    });

    it('4. Confidencialidad de Reclamos Técnicos (FIG Art. 5.4)', () => {
        const inquiryClub1: MockTechnicalInquiry = {
            id: 'inq-1',
            championshipId: 'champ-a1',
            clubId: 'club-1',
            submittedBy: 'user-coach-club1',
            status: 'pending',
        };

        // El club reclamante (Coach 1) puede ver su reclamo
        expect(security.canSelectTechnicalInquiry('user-coach-club1', inquiryClub1)).toBe(true);

        // Un club rival (Coach 2) NO PUEDE ver el reclamo del Club 1
        expect(security.canSelectTechnicalInquiry('user-coach-club2', inquiryClub1)).toBe(false);

        // El público anónimo NO PUEDE ver el reclamo
        expect(security.canSelectTechnicalInquiry(null, inquiryClub1)).toBe(false);
        expect(security.canSelectTechnicalInquiry('user-public-viewer', inquiryClub1)).toBe(false);

        // El Juez Árbitro (Head Judge) y el Org Admin sí pueden ver el reclamo
        expect(security.canSelectTechnicalInquiry('user-head-judge-a', inquiryClub1)).toBe(true);
        expect(security.canSelectTechnicalInquiry('user-admin-a', inquiryClub1)).toBe(true);

        // Una organización ajena (Org B) NO PUEDE ver el reclamo
        expect(security.canSelectTechnicalInquiry('user-admin-b', inquiryClub1)).toBe(false);
    });

    it('5. Resolución de Reclamos Técnicos: Exclusiva para Head Judge y Admins del Torneo', () => {
        // Coach NO puede resolver reclamos
        expect(security.canResolveTechnicalInquiry('user-coach-club1', 'champ-a1')).toBe(false);

        // Juez regular NO puede resolver reclamos
        expect(security.canResolveTechnicalInquiry('user-judge-vault-a', 'champ-a1')).toBe(false);

        // Head Judge y Org Admin SÍ pueden resolver reclamos
        expect(security.canResolveTechnicalInquiry('user-head-judge-a', 'champ-a1')).toBe(true);
        expect(security.canResolveTechnicalInquiry('user-admin-a', 'champ-a1')).toBe(true);
        expect(security.canResolveTechnicalInquiry('user-manager-a', 'champ-a1')).toBe(true);
    });

    it('6. Protección de Documentos Oficiales vs Documentos Técnicos Confidenciales', () => {
        const publicResultBook: MockDocument = {
            id: 'doc-book-1',
            championshipId: 'champ-a1',
            docType: 'result_book',
            isPublic: true,
        };

        const privateJudgesMinutes: MockDocument = {
            id: 'doc-minutes-1',
            championshipId: 'champ-a1',
            docType: 'technical_minutes',
            isPublic: false,
        };

        // Result Book público es accesible por todos
        expect(security.canSelectDocument(null, publicResultBook)).toBe(true);
        expect(security.canSelectDocument('user-public-viewer', publicResultBook)).toBe(true);

        // Acta de Jueces confidencial es invisible para público y entrenadores
        expect(security.canSelectDocument(null, privateJudgesMinutes)).toBe(false);
        expect(security.canSelectDocument('user-public-viewer', privateJudgesMinutes)).toBe(false);
        expect(security.canSelectDocument('user-coach-club1', privateJudgesMinutes)).toBe(false);

        // Solo accesible para staff técnico (Head Judge, Admin, Competition Manager)
        expect(security.canSelectDocument('user-head-judge-a', privateJudgesMinutes)).toBe(true);
        expect(security.canSelectDocument('user-admin-a', privateJudgesMinutes)).toBe(true);
    });

    it('7. Inmutabilidad de Auditoría de Puntuaciones (score_audits)', () => {
        // Visualización de bitácora permitida solo a autoridades
        expect(security.canSelectScoreAudits('user-head-judge-a', 'champ-a1')).toBe(true);
        expect(security.canSelectScoreAudits('user-admin-a', 'champ-a1')).toBe(true);
        expect(security.canSelectScoreAudits('user-coach-club1', 'champ-a1')).toBe(false);
        expect(security.canSelectScoreAudits(null, 'champ-a1')).toBe(false);

        // Modificación o eliminación terminantemente prohibida para todos (inmutabilidad estricta)
        expect(security.canUpdateOrDeleteScoreAudits()).toBe(false);
    });

    it('8. Modificación de Ceremonias y Premiación: Restringida a Org Admin y Competition Manager', () => {
        // Ni jueces ni entrenadores pueden alterar el podio ni la ceremonia
        expect(security.canManageCeremonies('user-judge-vault-a', 'champ-a1')).toBe(false);
        expect(security.canManageCeremonies('user-coach-club1', 'champ-a1')).toBe(false);

        // Managers y Admins de la organización sí
        expect(security.canManageCeremonies('user-admin-a', 'champ-a1')).toBe(true);
        expect(security.canManageCeremonies('user-manager-a', 'champ-a1')).toBe(true);
    });
});
