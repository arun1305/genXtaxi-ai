/**
 * Roles propagated from the existing GenXTaxi JWT (spec §1 Auth & tenancy).
 * NOTE: the live gen-taxi-backend uses the literal value "passenger" (the spec
 * calls this actor "rider"). We match the real token so auth actually validates.
 */
export enum Role {
  PASSENGER = 'passenger',
  DRIVER = 'driver',
  ADMIN = 'admin',
}
