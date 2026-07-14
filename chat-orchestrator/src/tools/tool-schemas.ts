import { Role } from '@genxtaxi/ai-shared';
import { ToolSpec } from './tool.types';

/**
 * The tool registry (spec §2.4). Strict JSON-schema args + server-side role
 * scoping. Confirmation flags gate state-changing actions behind an explicit
 * user Confirm.
 */
export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'get_fare_estimate',
    description:
      'Estimate the fare for a trip. Returns {amount, currency} plus any surge multiplier. Read-only.',
    allowedRoles: [Role.PASSENGER, Role.DRIVER],
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        pickup: { type: 'string', description: 'Pickup address or "lat,lng"' },
        dropoff: { type: 'string', description: 'Dropoff address or "lat,lng"' },
        ride_type: { type: 'string', description: 'e.g. economy, premium' },
      },
      required: ['pickup', 'dropoff', 'ride_type'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_ride_status',
    description: "Get the status of a ride. Defaults to the user's active ride.",
    allowedRoles: [Role.PASSENGER, Role.DRIVER],
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        ride_id: { type: 'string', description: 'Optional; defaults to active ride' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'book_ride',
    description:
      'Book a ride. MUST be confirmed by the user via an action card before it commits.',
    allowedRoles: [Role.PASSENGER],
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        pickup: { type: 'string' },
        dropoff: { type: 'string' },
        ride_type: { type: 'string' },
        scheduled_at: { type: 'string', description: 'Optional ISO datetime' },
      },
      required: ['pickup', 'dropoff', 'ride_type'],
      additionalProperties: false,
    },
  },
  {
    name: 'cancel_ride',
    description:
      'Cancel a ride. Returns any cancellation {fee, currency} and requires user confirmation before it commits.',
    allowedRoles: [Role.PASSENGER, Role.DRIVER],
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        ride_id: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['ride_id', 'reason'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_payment_history',
    description:
      'List the user\'s recent payments/transactions. Card numbers are never returned.',
    allowedRoles: [Role.PASSENGER, Role.DRIVER],
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        range: { type: 'string', description: 'e.g. last_30_days' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'initiate_refund',
    description:
      'Request a refund for a ride. The refund is queued for admin approval; the currency must match the original charge. Requires user confirmation.',
    allowedRoles: [Role.PASSENGER],
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        ride_id: { type: 'string' },
        amount: { type: 'integer', description: 'Integer minor units' },
        currency: { type: 'string', description: 'ISO 4217, must match original charge' },
        reason: { type: 'string' },
      },
      required: ['ride_id', 'amount', 'currency', 'reason'],
      additionalProperties: false,
    },
  },
  {
    name: 'explain_charge',
    description: 'Explain the fare breakdown for a ride with its currency. Read-only.',
    allowedRoles: [Role.PASSENGER, Role.DRIVER],
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: { ride_id: { type: 'string' } },
      required: ['ride_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Escalate the conversation to a human agent, attaching the transcript.',
    allowedRoles: [Role.PASSENGER, Role.DRIVER],
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        priority: { type: 'string', enum: ['normal', 'high', 'urgent'] },
      },
      required: ['summary'],
      additionalProperties: false,
    },
  },
];

export const TOOL_SPEC_BY_NAME = new Map(TOOL_SPECS.map((t) => [t.name, t]));
