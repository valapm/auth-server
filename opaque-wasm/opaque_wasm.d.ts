/* tslint:disable */
/* eslint-disable */
/**
*/
export class HandleLogin {
  free(): void;
/**
*/
  constructor();
/**
* @param {Uint8Array} password_file
* @param {Uint8Array} credential_request
* @param {Uint8Array} server_privatekey
* @returns {Uint8Array}
*/
  start(password_file: Uint8Array, credential_request: Uint8Array, server_privatekey: Uint8Array): Uint8Array;
/**
* @param {Uint8Array} credential_finish
* @returns {Uint8Array}
*/
  finish(credential_finish: Uint8Array): Uint8Array;
}
/**
*/
export class HandleRegistration {
  free(): void;
/**
*/
  constructor();
/**
* @param {Uint8Array} registration_request
* @param {Uint8Array} server_privatekey
* @returns {Uint8Array}
*/
  start(registration_request: Uint8Array, server_privatekey: Uint8Array): Uint8Array;
/**
* @param {Uint8Array} registration_finish
* @returns {Uint8Array}
*/
  finish(registration_finish: Uint8Array): Uint8Array;
}
/**
*/
export class Login {
  free(): void;
/**
*/
  constructor();
/**
* @param {string} password
* @returns {Uint8Array}
*/
  start(password: string): Uint8Array;
/**
* @param {Uint8Array} message
* @returns {Uint8Array}
*/
  finish(message: Uint8Array): Uint8Array;
/**
* @returns {Uint8Array}
*/
  getSessionKey(): Uint8Array;
}
/**
*/
export class Registration {
  free(): void;
/**
*/
  constructor();
/**
* @param {string} password
* @returns {Uint8Array}
*/
  start(password: string): Uint8Array;
/**
* @param {Uint8Array} message
* @returns {Uint8Array}
*/
  finish(message: Uint8Array): Uint8Array;
}
