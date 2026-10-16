// Escolhe o acesso a dados: Firebase (uso real) ou demonstração (dados fictícios).
import { MODO_DEMO } from '../config.js';

export const backend = MODO_DEMO ? await import('./demo.js') : await import('./firebase.js');
