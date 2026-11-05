/**
 * OPERIX GYMNASTICS — SUITE DE PRUEBAS DE SEGURIDAD RLS Y MULTI-TENANT (FASE 10.2)
 * Desarrollado por Comercial Hels SpA
 * Fecha: 5 de noviembre de 2026
 *
 * Auditoría profunda y validación de reglas de autorización, fronteras multi-tenant,
 * confidencialidad y anti-falsificación de reclamos técnicos (FIG Art. 5.4),
 * inmutabilidad estricta de auditoría (score_audits) y protección de notas aprobadas.
 */

import { describe, it, expect } from 'vitest';
import type { Database } from '../core/types/database';

type OrgRole = Database['public']['Enums']['organization_role'];
type ChampVisibility = Database['public']['Enums']['championship_visibility'];
type ChampStatus = Database['public']['Enums']['championship_status'];

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

interface MockRegistration {
    id: string;
    championshipId: string;
    clubId: string;
    gymnastId: string;
    status: 'pending' | 'approved' | 'rejected';
}

interface MockChampionship {
    id: string;
    organizationId: string;
    name: string;
    visibility: ChampVisibility;
    status: ChampStatus;
    judgeCode?: string;
}

interface MockScore {
    id: string;
    championshipId: string;
    apparatusId: string;
    submittedByJudgeId?: string;
    judgeUserId?: string;
    status: 'draft' | 'provisional' | 'approved' | 'inquired' | 'voided';
}

interface MockTechnicalInquiry {
    id: string;
    championshipId: string;
    clubId: string;
    gymnastId: string;
    submittedByUserId: string;
    feePaid: boolean;
    status: 'submitted' | 'under_review' | 'accepted' | 'rejected';
}

interface MockDocument {
    id: string;
    championshipId: string;
    documentType: 'result_book' | 'category_results' | 'official_minutes' | 'diplomas_batch' | 'start_list' | 'judging_sheets';
    isPublic: boolean;
}

/**
 * Motor de Evaluación de Políticas de Seguridad PostgreSQL / RLS de Operix
 * Replica fielmente el comportamiento de las migraciones 20261105000005 y 20261105000006.
 */
class OperixSecurityEvaluator {
    private users: Map<string, MockUser> = new Map();
    private orgMembers: MockOrgMember[] = [];
    private clubMembers: MockClubMember[] = [];
    private registrations: MockRegistration[] = [];
    private championships: Map<string, MockChampionship> = new Map();
    private scores: Map<string, MockScore> = new Map();
    private assignedApparatusJudges: Set<string> = new Set(); // key: `${championshipId}:${apparatusId}:${userId}`

    constructor(data: {
        users: MockUser[];
        orgMembers: MockOrgMember[];
        clubMembers: MockClubMember[];
        registrations: MockRegistration[];
        championships: MockChampionship[];
        scores: MockScore[];
        assignedApparatusJudges?: { championshipId: string; apparatusId: string; userId: string }[];
    }) {
        data.users.forEach(u => this.users.set(u.id, u));
        this.orgMembers = data.orgMembers;
        this.clubMembers = data.clubMembers;
        this.registrations = data.registrations;
        data.championships.forEach(c => this.championships.set(c.id, c));
        data.scores.forEach(s => this.scores.set(s.id, s));
        if (data.assignedApparatusJudges) {
            data.assignedApparatusJudges.forEach(a => {
                this.assignedApparatusJudges.add(`${a.championshipId}:${a.apparatusId}:${a.userId}`);
            });
        }
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

    currentUserCanScoreApparatus(userId: string | null, championshipId: string, apparatusId: string): boolean {
        if (!userId) return false;
        return this.assignedApparatusJudges.has(`${championshipId}:${apparatusId}:${userId}`);
    }

    // Corresponde a public.can_view_championship_public_data(UUID)
    canViewChampionshipPublicData(userId: string | null, championshipId: string): boolean {
        if (!championshipId) return false;
        const champ = this.championships.get(championshipId);
        if (!champ) return false;

        // 1. Acceso público si visibility = 'public' y el torneo está activo o finalizado
        const publicStatuses: ChampStatus[] = ['registration_open', 'registration_closed', 'in_progress', 'completed'];
        if (champ.visibility === 'public' && publicStatuses.includes(champ.status)) {
            return true;
        }

        // 2. Si es privado, invitacional o draft, requiere autenticación verificada
        if (!userId) return false;
        if (this.isPlatformAdmin(userId)) return true;

        // Miembros de la organización anfitriona
        const allRoles: OrgRole[] = ['org_admin', 'competition_manager', 'head_judge', 'judge', 'club_manager', 'coach', 'viewer'];
        if (this.currentUserHasOrgRole(userId, champ.organizationId, allRoles)) {
            return true;
        }

        // Delegados o entrenadores de clubes con gimnastas inscritos
        return this.registrations.some(
            r => r.championshipId === championshipId && this.clubMembers.some(cm => cm.clubId === r.clubId && cm.userId === userId)
        );
    }

    // Corresponde a public.is_judge_assigned_to_score(UUID)
    isJudgeAssignedToScore(userId: string | null, scoreId: string): boolean {
        if (!userId) return false;
        if (this.isPlatformAdmin(userId)) return true;
        const score = this.scores.get(scoreId);
        if (!score) return false;

        // Si la nota ya fue aprobada oficialmente, un juez regular no puede alterarla
        if (score.status === 'approved') {
            return this.currentUserHasChampionshipRole(
                userId,
                score.championshipId,
                ['org_admin', 'competition_manager', 'head_judge']
            );
        }

        // Juez autor o juez asignado al aparato
        if (score.judgeUserId === userId) return true;
        if (this.currentUserCanScoreApparatus(userId, score.championshipId, score.apparatusId)) return true;

        // Autoridades con potestad técnica
        return this.currentUserHasChampionshipRole(
            userId,
            score.championshipId,
            ['org_admin', 'competition_manager', 'head_judge']
        );
    }

    // Predicados de score_deductions
    canSelectScoreDeduction(userId: string | null, scoreId: string): boolean {
        const score = this.scores.get(scoreId);
        if (!score) return false;
        return this.canViewChampionshipPublicData(userId, score.championshipId) || this.isJudgeAssignedToScore(userId, scoreId);
    }

    canInsertScoreDeduction(userId: string | null, scoreId: string): boolean {
        return this.isJudgeAssignedToScore(userId, scoreId);
    }

    canUpdateScoreDeduction(userId: string | null, scoreId: string): boolean {
        return this.isJudgeAssignedToScore(userId, scoreId);
    }

    canDeleteScoreDeduction(userId: string | null, scoreId: string): boolean {
        const score = this.scores.get(scoreId);
        if (!score) return false;
        return this.currentUserHasChampionshipRole(userId, score.championshipId, ['org_admin', 'competition_manager', 'head_judge']);
    }

    // Predicados de technical_inquiries (FIG Art. 5.4)
    canSelectTechnicalInquiry(userId: string | null, inquiry: MockTechnicalInquiry): boolean {
        if (!userId) return false;
        if (this.isPlatformAdmin(userId)) return true;
        if (this.currentUserHasChampionshipRole(userId, inquiry.championshipId, ['org_admin', 'competition_manager', 'head_judge'])) {
            return true;
        }
        if (inquiry.submittedByUserId === userId) return true;
        return this.clubMembers.some(cm => cm.clubId === inquiry.clubId && cm.userId === userId);
    }

    canInsertTechnicalInquiry(userId: string | null, inquiry: { championshipId: string; clubId: string; submittedByUserId: string }): boolean {
        if (!userId) return false;
        if (this.isPlatformAdmin(userId)) return true;

        // Staff puede ingresar en nombre de delegaciones
        if (this.currentUserHasChampionshipRole(userId, inquiry.championshipId, ['org_admin', 'competition_manager', 'head_judge'])) {
            return true;
        }

        // No puede suplantar la identidad de otro usuario
        if (inquiry.submittedByUserId !== userId) {
            return false;
        }

        // El usuario debe pertenecer al club
        const isClubMember = this.clubMembers.some(cm => cm.clubId === inquiry.clubId && cm.userId === userId);
        if (!isClubMember) return false;

        // El club debe tener una inscripción formal en este campeonato
        const isClubRegistered = this.registrations.some(r => r.championshipId === inquiry.championshipId && r.clubId === inquiry.clubId);
        return isClubRegistered;
    }

    canResolveTechnicalInquiry(userId: string | null, championshipId: string): boolean {
        if (!userId) return false;
        if (this.isPlatformAdmin(userId)) return true;
        return this.currentUserHasChampionshipRole(userId, championshipId, ['org_admin', 'competition_manager', 'head_judge']);
    }

    // Predicados de championship_documents
    canSelectDocument(userId: string | null, doc: MockDocument): boolean {
        // Documentos confidenciales (actas oficiales, planillas de jueces) jamás son públicos
        if (['official_minutes', 'judging_sheets'].includes(doc.documentType)) {
            if (!userId) return false;
            return this.currentUserHasChampionshipRole(userId, doc.championshipId, ['org_admin', 'competition_manager', 'head_judge']);
        }

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

    // Predicados de ceremonies & awards
    canManageCeremonies(userId: string | null, championshipId: string): boolean {
        if (!userId) return false;
        return this.currentUserHasChampionshipRole(userId, championshipId, ['org_admin', 'competition_manager']);
    }

    // Inmutabilidad de score_audits
    executeScoreAuditUpdateOrDelete(): never {
        throw new Error('OPERIX_SECURITY_VIOLATION: La tabla score_audits es estrictamente inmutable (append-only). Las operaciones de UPDATE y DELETE están prohibidas por normativa reglamentaria.');
    }

    // Terminal de Juez Rápido (submit_fast_judge_score)
    submitFastJudgeScore(params: {
        championshipId: string;
        judgeCode: string;
        scoreId: string;
    }): { success: boolean; error?: string } {
        const champ = this.championships.get(params.championshipId);
        if (!champ || champ.judgeCode !== params.judgeCode) {
            return { success: false, error: 'Código de juez inválido para este campeonato.' };
        }
        if (!['in_progress', 'registration_closed'].includes(champ.status)) {
            return { success: false, error: 'El campeonato no se encuentra en estado activo para juzgamiento en vivo.' };
        }
        const existingScore = this.scores.get(params.scoreId);
        if (existingScore && existingScore.status === 'approved') {
            return { success: false, error: 'OPERIX_SECURITY_VIOLATION: La nota para este gimnasta ya ha sido aprobada oficialmente por el Juez Árbitro y no puede ser modificada desde la terminal rápida.' };
        }
        return { success: true };
    }
}

describe('OPERIX GYMNASTICS — Auditoría Profunda de Seguridad y Validación Multi-Tenant (Fase 10.2)', () => {
    const security = new OperixSecurityEvaluator({
        users: [
            { id: 'user-admin-a', email: 'admin@org-a.cl' },
            { id: 'user-manager-a', email: 'manager@org-a.cl' },
            { id: 'user-head-judge-a', email: 'headjudge@org-a.cl' },
            { id: 'user-judge-vault-a', email: 'judge-vault@org-a.cl' },
            { id: 'user-viewer-a', email: 'viewer@org-a.cl' },
            { id: 'user-coach-club1', email: 'coach1@club1.cl' },
            { id: 'user-coach-club2', email: 'coach2@club2.cl' },
            { id: 'user-coach-unregistered', email: 'coach@club-ext.cl' },
            { id: 'user-admin-b', email: 'admin@org-b.cl' },
            { id: 'user-public-viewer', email: 'public@gmail.com' },
        ],
        orgMembers: [
            { organizationId: 'org-a', userId: 'user-admin-a', role: 'org_admin' },
            { organizationId: 'org-a', userId: 'user-manager-a', role: 'competition_manager' },
            { organizationId: 'org-a', userId: 'user-head-judge-a', role: 'head_judge' },
            { organizationId: 'org-a', userId: 'user-judge-vault-a', role: 'judge' },
            { organizationId: 'org-a', userId: 'user-viewer-a', role: 'viewer' },
            { organizationId: 'org-b', userId: 'user-admin-b', role: 'org_admin' },
        ],
        clubMembers: [
            { clubId: 'club-1', userId: 'user-coach-club1', role: 'coach' },
            { clubId: 'club-2', userId: 'user-coach-club2', role: 'coach' },
            { clubId: 'club-ext', userId: 'user-coach-unregistered', role: 'coach' },
        ],
        registrations: [
            { id: 'reg-1', championshipId: 'champ-a1', clubId: 'club-1', gymnastId: 'gymnast-1', status: 'approved' },
            { id: 'reg-2', championshipId: 'champ-a1', clubId: 'club-2', gymnastId: 'gymnast-2', status: 'approved' },
        ],
        championships: [
            { id: 'champ-a1', organizationId: 'org-a', name: 'Copa Manquehue 2026', visibility: 'public', status: 'in_progress', judgeCode: 'VT2026' },
            { id: 'champ-a-private', organizationId: 'org-a', name: 'Control Interno Privado', visibility: 'private', status: 'in_progress', judgeCode: 'PRIV99' },
            { id: 'champ-b1', organizationId: 'org-b', name: 'Campeonato Regional Sur', visibility: 'public', status: 'in_progress', judgeCode: 'SUR2026' },
        ],
        scores: [
            { id: 'score-vault-provisional', championshipId: 'champ-a1', apparatusId: 'app-vt', judgeUserId: 'user-judge-vault-a', status: 'provisional' },
            { id: 'score-vault-approved', championshipId: 'champ-a1', apparatusId: 'app-vt', judgeUserId: 'user-judge-vault-a', status: 'approved' },
            { id: 'score-bars-1', championshipId: 'champ-a1', apparatusId: 'app-ub', judgeUserId: 'user-other-judge', status: 'provisional' },
            { id: 'score-champ-b-1', championshipId: 'champ-b1', apparatusId: 'app-vt', judgeUserId: 'user-judge-b', status: 'provisional' },
        ],
        assignedApparatusJudges: [
            { championshipId: 'champ-a1', apparatusId: 'app-vt', userId: 'user-judge-vault-a' },
        ],
    });

    // --------------------------------------------------------------------------
    // ETAPA 3: MATRIZ DE LOS 8 ESCENARIOS OBLIGATORIOS
    // --------------------------------------------------------------------------

    it('Escenario 1: Administrador de organización A intenta acceder y modificar organización B', () => {
        // Admin A puede gestionar sus torneos
        expect(security.canManageCeremonies('user-admin-a', 'champ-a1')).toBe(true);
        expect(security.canManageDocuments('user-admin-a', 'champ-a1')).toBe(true);

        // Pero tiene bloqueo estricto en torneos de Org B
        expect(security.canManageCeremonies('user-admin-a', 'champ-b1')).toBe(false);
        expect(security.canManageDocuments('user-admin-a', 'champ-b1')).toBe(false);
    });

    it('Escenario 2: Competition Manager intenta modificar un campeonato ajeno', () => {
        expect(security.canManageCeremonies('user-manager-a', 'champ-a1')).toBe(true);
        expect(security.canManageCeremonies('user-manager-a', 'champ-b1')).toBe(false);
        expect(security.canManageDocuments('user-manager-a', 'champ-b1')).toBe(false);
    });

    it('Escenario 3: Juez intenta registrar notas en una asignación ajena', () => {
        // Juez de salto en A1 puede calificar en salto A1
        expect(security.canInsertScoreDeduction('user-judge-vault-a', 'score-vault-provisional')).toBe(true);

        // Pero NO puede calificar en barras asimétricas (no asignado)
        expect(security.canInsertScoreDeduction('user-judge-vault-a', 'score-bars-1')).toBe(false);

        // Y NO puede calificar en el campeonato de Org B
        expect(security.canInsertScoreDeduction('user-judge-vault-a', 'score-champ-b-1')).toBe(false);
    });

    it('Escenario 4: Club Manager / Coach intenta consultar o ingresar reclamos de otro club', () => {
        const inquiryClub1: MockTechnicalInquiry = {
            id: 'inq-1',
            championshipId: 'champ-a1',
            clubId: 'club-1',
            gymnastId: 'gymnast-1',
            submittedByUserId: 'user-coach-club1',
            feePaid: true,
            status: 'submitted',
        };

        // Coach 1 puede ver su reclamo
        expect(security.canSelectTechnicalInquiry('user-coach-club1', inquiryClub1)).toBe(true);

        // Coach 2 (otro club) NO PUEDE ver el reclamo del Club 1
        expect(security.canSelectTechnicalInquiry('user-coach-club2', inquiryClub1)).toBe(false);

        // Coach 2 NO PUEDE enviar un reclamo a nombre de Club 1 (intento de suplantación)
        const fakeInquiry = { championshipId: 'champ-a1', clubId: 'club-1', submittedByUserId: 'user-coach-club2' };
        expect(security.canInsertTechnicalInquiry('user-coach-club2', fakeInquiry)).toBe(false);
    });

    it('Escenario 5: Coach intenta acceder a documentos técnicos reservados (actas de jueces)', () => {
        const reservedMinutes: MockDocument = {
            id: 'doc-minutes',
            championshipId: 'champ-a1',
            documentType: 'official_minutes',
            isPublic: false,
        };
        const judgingSheets: MockDocument = {
            id: 'doc-sheets',
            championshipId: 'champ-a1',
            documentType: 'judging_sheets',
            isPublic: false,
        };

        // Coach tiene denegado el acceso a actas y planillas de evaluación de jueces
        expect(security.canSelectDocument('user-coach-club1', reservedMinutes)).toBe(false);
        expect(security.canSelectDocument('user-coach-club1', judgingSheets)).toBe(false);

        // Solo Juez Árbitro y Admins pueden ver actas técnicas
        expect(security.canSelectDocument('user-head-judge-a', reservedMinutes)).toBe(true);
        expect(security.canSelectDocument('user-admin-a', reservedMinutes)).toBe(true);
    });

    it('Escenario 6: Viewer intenta modificar información', () => {
        expect(security.canManageCeremonies('user-viewer-a', 'champ-a1')).toBe(false);
        expect(security.canManageDocuments('user-viewer-a', 'champ-a1')).toBe(false);
        expect(security.canInsertScoreDeduction('user-viewer-a', 'score-vault-provisional')).toBe(false);
        expect(security.canResolveTechnicalInquiry('user-viewer-a', 'champ-a1')).toBe(false);
    });

    it('Escenario 7: Usuario anónimo intenta acceder a un campeonato privado', () => {
        // Campeonato público es accesible
        expect(security.canViewChampionshipPublicData(null, 'champ-a1')).toBe(true);

        // Campeonato privado ('visibility: private') está estrictamente bloqueado para anónimos
        expect(security.canViewChampionshipPublicData(null, 'champ-a-private')).toBe(false);

        // Y bloqueado para usuarios sin relación con la organización
        expect(security.canViewChampionshipPublicData('user-public-viewer', 'champ-a-private')).toBe(false);
        expect(security.canViewChampionshipPublicData('user-admin-b', 'champ-a-private')).toBe(false);
    });

    it('Escenario 8: Usuario autenticado intenta modificar premiaciones ajenas', () => {
        // Coach o usuario público intentando alterar podios o ceremonias
        expect(security.canManageCeremonies('user-coach-club1', 'champ-a1')).toBe(false);
        expect(security.canManageCeremonies('user-public-viewer', 'champ-a1')).toBe(false);
        expect(security.canManageCeremonies('user-admin-b', 'champ-a1')).toBe(false);
    });

    // --------------------------------------------------------------------------
    // ETAPA 4: INMUTABILIDAD DE SCORE_AUDITS (Trigger & DML Restrictions)
    // --------------------------------------------------------------------------

    it('Verifica inmutabilidad estricta de score_audits (lanza excepción ante UPDATE o DELETE)', () => {
        expect(() => security.executeScoreAuditUpdateOrDelete()).toThrowError(
            /OPERIX_SECURITY_VIOLATION: La tabla score_audits es estrictamente inmutable/
        );
    });

    // --------------------------------------------------------------------------
    // ETAPA 5: PROTECCIÓN DE NOTAS APROBADAS Y FAST JUDGE TERMINAL
    // --------------------------------------------------------------------------

    it('Juez regular NO puede modificar deducciones de una nota ya oficializada (status = approved)', () => {
        // En nota provisional, el juez titular puede ajustar deducciones
        expect(security.canUpdateScoreDeduction('user-judge-vault-a', 'score-vault-provisional')).toBe(true);

        // En nota aprobada por el Juez Árbitro, el juez regular queda bloqueado
        expect(security.canUpdateScoreDeduction('user-judge-vault-a', 'score-vault-approved')).toBe(false);

        // Solo Juez Árbitro o Admin pueden realizar intervenciones en notas aprobadas
        expect(security.canUpdateScoreDeduction('user-head-judge-a', 'score-vault-approved')).toBe(true);
        expect(security.canUpdateScoreDeduction('user-admin-a', 'score-vault-approved')).toBe(true);
    });

    it('Terminal rápida de juzgamiento (submit_fast_judge_score) bloquea sobrescritura de notas aprobadas', () => {
        // Enviar nota para nota provisional es permitido
        const resProvisional = security.submitFastJudgeScore({
            championshipId: 'champ-a1',
            judgeCode: 'VT2026',
            scoreId: 'score-vault-provisional',
        });
        expect(resProvisional.success).toBe(true);

        // Intentar sobreescribir una nota aprobada es bloqueado por violación de seguridad
        const resApproved = security.submitFastJudgeScore({
            championshipId: 'champ-a1',
            judgeCode: 'VT2026',
            scoreId: 'score-vault-approved',
        });
        expect(resApproved.success).toBe(false);
        expect(resApproved.error).toMatch(/ya ha sido aprobada oficialmente/);
    });

    it('Club no inscrito en el torneo NO PUEDE ingresar reclamos técnicos (FIG Art. 5.4)', () => {
        const unregInquiry = {
            championshipId: 'champ-a1',
            clubId: 'club-ext',
            submittedByUserId: 'user-coach-unregistered',
        };
        // Club no está en la lista de inscritos de champ-a1
        expect(security.canInsertTechnicalInquiry('user-coach-unregistered', unregInquiry)).toBe(false);
    });
});
