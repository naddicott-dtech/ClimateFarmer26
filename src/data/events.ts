// ============================================================================
// Event Definitions — ClimateFarmer26 Slice 2a
// Concrete storylet data for 3 climate events.
// Evaluation order = array index order (deterministic).
// ============================================================================

import type { Storylet } from '../engine/events/types.ts';

/**
 * All storylets, evaluated in array index order.
 * This array is the single source of truth for event evaluation order.
 * Priority >= 100 means guaranteed fire when eligible.
 */
export const STORYLETS: readonly Storylet[] = [
  // --- 2a Events ---

  {
    id: 'heatwave-advisory',
    type: 'climate',
    title: 'Heatwave Advisory',
    description: 'The National Weather Service has issued a heatwave advisory for the San Joaquin Valley. Temperatures are expected to exceed 110°F for the next several days. Your crops are at risk.',
    preconditions: [
      { type: 'min_year', year: 2 },
      { type: 'season', season: 'summer' },
      { type: 'has_crop' },
      { type: 'random', probability: 0.30 },
    ],
    priority: 50,
    cooldownDays: 180,
    foreshadowing: {
      signal: 'Weather models show an extreme heat dome building over the Central Valley.',
      daysBeforeEvent: 7,
      reliability: 0.75,
    },
    choices: [
      {
        id: 'emergency-irrigation',
        label: 'Emergency Irrigation',
        description: 'Run irrigation continuously to cool crops and soil. Costs $500 but protects yield.',
        cost: 500,
        requiresCash: 500,
        effects: [
          { type: 'modify_cash', amount: -500 },
          { type: 'modify_moisture_all', amount: 2.0 },
          { type: 'add_notification', message: 'Emergency irrigation applied. Your crops survived the heat.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'wait-it-out',
        label: 'Wait It Out',
        description: 'Hope for the best. Crops may suffer yield loss.',
        effects: [
          { type: 'modify_yield_modifier', cropId: '*', multiplier: 0.85, durationDays: 14 },
          { type: 'add_notification', message: 'The heatwave damaged some crops. Yield reduced by 15%.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['climate', 'heat'],
  },

  {
    id: 'water-allocation-cut',
    type: 'regulatory',
    title: 'Water Allocation Cut',
    description: 'The State Water Resources Control Board has reduced irrigation allocations for your district due to drought conditions. You must decide how to manage with less water.',
    preconditions: [
      { type: 'min_year', year: 3 },
      { type: 'season', season: 'summer' },
      { type: 'random', probability: 0.20 },
    ],
    priority: 60,
    cooldownDays: 365,
    foreshadowing: {
      signal: 'State officials are reviewing water allocation policies. Cuts may be coming.',
      daysBeforeEvent: 14,
      reliability: 0.80,
    },
    choices: [
      {
        id: 'accept-higher-costs',
        label: 'Buy Supplemental Water',
        description: 'Purchase water from the spot market at higher prices. Irrigation costs increase by 50% for 90 days.',
        effects: [
          { type: 'modify_irrigation_cost', multiplier: 1.5, durationDays: 90 },
          { type: 'add_notification', message: 'You secured supplemental water rights. Irrigation costs increased for 90 days.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'cut-irrigation',
        label: 'Accept Reduced Irrigation',
        description: 'Follow the restriction. No watering for 45 days.',
        effects: [
          { type: 'restrict_watering', durationDays: 45 },
          { type: 'add_notification', message: 'Water restriction in effect. No irrigation for 45 days.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['regulatory', 'water'],
  },

  {
    id: 'late-frost-warning',
    type: 'climate',
    title: 'Late Frost Warning',
    description: 'An unexpected cold front is moving through the valley. Overnight temperatures may drop below freezing, threatening young crops.',
    preconditions: [
      { type: 'season', season: 'spring' },
      { type: 'has_crop' },
      { type: 'random', probability: 0.15 },
    ],
    priority: 55,
    cooldownDays: 365,
    foreshadowing: {
      signal: 'Unusual cold air mass detected moving south through the valley.',
      daysBeforeEvent: 3,
      reliability: 0.90,
    },
    choices: [
      {
        id: 'frost-protection',
        label: 'Frost Protection',
        description: 'Deploy frost blankets and wind machines. Costs $300 but saves your crops.',
        cost: 300,
        requiresCash: 300,
        effects: [
          { type: 'modify_cash', amount: -300 },
          { type: 'add_notification', message: 'Frost protection deployed. Your crops survived the cold snap.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'accept-risk',
        label: 'Accept the Risk',
        description: 'Frost damage is possible. Yield may be reduced.',
        effects: [
          { type: 'modify_yield_modifier', cropId: '*', multiplier: 0.70, durationDays: 7 },
          { type: 'add_notification', message: 'Frost damaged some crops. Yield reduced by 30%.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['climate', 'frost'],
  },
] as const;
