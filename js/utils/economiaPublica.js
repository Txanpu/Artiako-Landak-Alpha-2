'use strict';

/**
 * EstadoEconomico centraliza el manejo de fondos públicos,
 * la suerte y los eventos asociados. Evita duplicidades entre
 * "dinero del Estado" y "dinero del gobierno".
 */
class EstadoEconomico {
  constructor(fondosIniciales = 0) {
    this.fondos = fondosIniciales;   // única bolsa de dinero
    this.suerte = 0;                 // modificador de suerte
    this.eventos = [];               // historial de eventos
  }

  /** Ingresa dinero a la bolsa pública */
  recaudar(monto) {
    if (!Number.isFinite(monto)) return;
    this.fondos += monto;
  }

  /** Gasta de la bolsa pública, evitando valores negativos */
  gastar(monto) {
    if (!Number.isFinite(monto)) return false;
    const m = Math.max(0, Math.round(monto));
    if (m > this.fondos) return false;
    this.fondos -= m;
    return true;
  }

  /** Ajusta la suerte (positivo o negativo) */
  modificarSuerte(delta) {
    if (!Number.isFinite(delta)) return;
    this.suerte += delta;
  }

  /**
   * Ejecuta un evento que afecta dinero y suerte.
   * @param {Object} opts
   * @param {number} opts.costo       - lo que se resta de fondos.
   * @param {number} opts.beneficio   - lo que se suma a fondos.
   * @param {number} opts.efectoSuerte - modificador de suerte.
   * @param {string} opts.descripcion - texto opcional del evento.
   */
  ejecutarEvento({ costo = 0, beneficio = 0, efectoSuerte = 0, descripcion = '' } = {}) {
    this.gastar(costo);
    this.recaudar(beneficio);
    this.modificarSuerte(efectoSuerte);
    if (descripcion) this.eventos.push(descripcion);
  }
}

module.exports = { EstadoEconomico };
