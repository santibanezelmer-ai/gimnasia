/**
 * Operix Arena Realtime Broadcast Protocol.
 * Protocolo de Sincronización en Tiempo Real para Pantalla Gigante / Modo Arena.
 * Ciclo Olímpico FIG 2025-2028.
 * 
 * Desarrollado por Comercial Hels SpA.
 * 
 * Características:
 * 1. Protocolo versionado ('1.0') con sobre inmutable (championshipId, ceremonyKey, sequence, timestamp).
 * 2. Validación de secuencia monótona para ignorar paquetes desordenados o retrasados.
 * 3. Recuperación automática de estado ante reconexión (Request Sync / Announce State).
 * 4. Separación de roles: operadores autorizados emiten comandos; pantallas públicas solo escuchan.
 */

import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

export const ARENA_PROTOCOL_VERSION = '1.0'

export type ArenaBroadcastEventType =
  | 'ARENA_REVEAL_STEP'
  | 'ARENA_CHANGE_CEREMONY'
  | 'ARENA_REQUEST_SYNC'
  | 'ARENA_ANNOUNCE_STATE'

export interface ArenaStateMessage {
  version: typeof ARENA_PROTOCOL_VERSION
  championshipId: string
  ceremonyKey: string
  ceremonyIndex: number
  revealedStep: number // 0: oculto, 1: 3er lugar (Bronce), 2: 2do lugar (Plata), 3: 1er lugar (Campeón)
  sequence: number
  timestamp: string
  operatorUserId?: string
  operatorRole?: string
}

export interface ArenaSyncRequestMessage {
  version: typeof ARENA_PROTOCOL_VERSION
  championshipId: string
  clientInstanceId: string
  timestamp: string
}

export interface ArenaSyncState {
  ceremonyKey: string
  ceremonyIndex: number
  revealedStep: number
  sequence: number
  lastUpdated: string
}

export class ArenaRealtimeController {
  private channel: RealtimeChannel | null = null
  private championshipId: string
  private currentSequence: number = 0
  private currentState: ArenaSyncState
  private onStateChangeCallback?: (state: ArenaSyncState) => void
  private isOperator: boolean = false
  private operatorUserId?: string
  private operatorRole?: string

  constructor(params: {
    championshipId: string
    initialCeremonyKey: string
    initialCeremonyIndex?: number
    initialStep?: number
    isOperator?: boolean
    operatorUserId?: string
    operatorRole?: string
    onStateChange?: (state: ArenaSyncState) => void
  }) {
    this.championshipId = params.championshipId
    this.isOperator = Boolean(params.isOperator)
    this.operatorUserId = params.operatorUserId
    this.operatorRole = params.operatorRole
    this.onStateChangeCallback = params.onStateChange

    this.currentState = {
      ceremonyKey: params.initialCeremonyKey,
      ceremonyIndex: params.initialCeremonyIndex ?? 0,
      revealedStep: params.initialStep ?? 3,
      sequence: 0,
      lastUpdated: new Date().toISOString(),
    }
  }

  /**
   * Conecta al canal Supabase Realtime Broadcast.
   */
  public subscribe(supabaseClient: SupabaseClient): void {
    if (this.channel) {
      this.channel.unsubscribe()
    }

    const channelName = `arena_awards_${this.championshipId}`
    this.channel = supabaseClient.channel(channelName, {
      config: {
        broadcast: {
          ack: true,
          self: false, // Don't echo to self
        },
      },
    })

    // 1. Escuchar eventos de cambio de paso o ceremonia
    this.channel
      .on('broadcast', { event: 'ARENA_STATE_EVENT' }, (payload: { payload: ArenaStateMessage }) => {
        this.handleIncomingState(payload.payload)
      })
      // 2. Escuchar solicitudes de sincronización (para reconexiones de pantallas)
      .on('broadcast', { event: 'ARENA_REQUEST_SYNC' }, (payload: { payload: ArenaSyncRequestMessage }) => {
        if (this.isOperator && payload.payload.championshipId === this.championshipId) {
          this.announceCurrentState()
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && !this.isOperator) {
          // Si es pantalla display, solicita de inmediato el estado actual al operador
          this.requestSync()
        }
      })
  }

  /**
   * Procesa un mensaje entrante verificando versión y secuencia monótona.
   */
  public handleIncomingState(msg: ArenaStateMessage): boolean {
    if (!msg || msg.version !== ARENA_PROTOCOL_VERSION) return false
    if (msg.championshipId !== this.championshipId) return false

    // Protección contra paquetes desordenados o antiguos
    if (msg.sequence <= this.currentState.sequence) {
      // Ignorar estado antiguo
      return false
    }

    this.currentState = {
      ceremonyKey: msg.ceremonyKey,
      ceremonyIndex: msg.ceremonyIndex,
      revealedStep: msg.revealedStep,
      sequence: msg.sequence,
      lastUpdated: msg.timestamp,
    }

    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.currentState)
    }

    return true
  }

  /**
   * Operador: Cambia el paso de revelación (0, 1, 2, 3) y lo transmite.
   */
  public broadcastRevealStep(step: number): void {
    if (!this.isOperator) return
    this.currentSequence++

    const message: ArenaStateMessage = {
      version: ARENA_PROTOCOL_VERSION,
      championshipId: this.championshipId,
      ceremonyKey: this.currentState.ceremonyKey,
      ceremonyIndex: this.currentState.ceremonyIndex,
      revealedStep: step,
      sequence: this.currentSequence,
      timestamp: new Date().toISOString(),
      operatorUserId: this.operatorUserId,
      operatorRole: this.operatorRole,
    }

    this.currentState.revealedStep = step
    this.currentState.sequence = this.currentSequence
    this.currentState.lastUpdated = message.timestamp

    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'ARENA_STATE_EVENT',
        payload: message,
      })
    }
  }

  /**
   * Operador: Cambia la ceremonia activa (e.g. salto a barras asimétricas) y reinicia el podio.
   */
  public broadcastChangeCeremony(ceremonyKey: string, ceremonyIndex: number, defaultStep: number = 0): void {
    if (!this.isOperator) return
    this.currentSequence++

    const message: ArenaStateMessage = {
      version: ARENA_PROTOCOL_VERSION,
      championshipId: this.championshipId,
      ceremonyKey,
      ceremonyIndex,
      revealedStep: defaultStep,
      sequence: this.currentSequence,
      timestamp: new Date().toISOString(),
      operatorUserId: this.operatorUserId,
      operatorRole: this.operatorRole,
    }

    this.currentState.ceremonyKey = ceremonyKey
    this.currentState.ceremonyIndex = ceremonyIndex
    this.currentState.revealedStep = defaultStep
    this.currentState.sequence = this.currentSequence
    this.currentState.lastUpdated = message.timestamp

    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'ARENA_STATE_EVENT',
        payload: message,
      })
    }
  }

  /**
   * Operador: Anuncia el estado actual a pantallas recién conectadas.
   */
  public announceCurrentState(): void {
    if (!this.isOperator || !this.channel) return

    const message: ArenaStateMessage = {
      version: ARENA_PROTOCOL_VERSION,
      championshipId: this.championshipId,
      ceremonyKey: this.currentState.ceremonyKey,
      ceremonyIndex: this.currentState.ceremonyIndex,
      revealedStep: this.currentState.revealedStep,
      sequence: this.currentSequence,
      timestamp: new Date().toISOString(),
      operatorUserId: this.operatorUserId,
      operatorRole: this.operatorRole,
    }

    this.channel.send({
      type: 'broadcast',
      event: 'ARENA_STATE_EVENT',
      payload: message,
    })
  }

  /**
   * Pantalla Arena: Solicita sincronización ante reconexión.
   */
  public requestSync(): void {
    if (!this.channel) return

    const req: ArenaSyncRequestMessage = {
      version: ARENA_PROTOCOL_VERSION,
      championshipId: this.championshipId,
      clientInstanceId: `display_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
    }

    this.channel.send({
      type: 'broadcast',
      event: 'ARENA_REQUEST_SYNC',
      payload: req,
    })
  }

  /**
   * Desconecta y limpia el canal.
   */
  public disconnect(): void {
    if (this.channel) {
      this.channel.unsubscribe()
      this.channel = null
    }
  }

  public getState(): ArenaSyncState {
    return { ...this.currentState }
  }
}
