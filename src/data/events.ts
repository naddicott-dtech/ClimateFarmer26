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

  // --- Slice 3a1: Stretch Events ---

  {
    id: 'tomato-market-surge',
    type: 'market',
    title: 'Tomato Market Surge',
    description: 'Processing tomato prices have spiked due to supply shortages in other growing regions. If you have tomatoes in the field, this could be a windfall.',
    preconditions: [
      { type: 'season_not', season: 'winter' },
      { type: 'min_year', year: 2 },
      { type: 'random', probability: 0.10 },
    ],
    priority: 45,
    cooldownDays: 365,
    choices: [
      {
        id: 'acknowledge-surge',
        label: 'Good to Know',
        description: 'Tomato prices will be 40% higher for the next 60 days.',
        effects: [
          { type: 'modify_price_modifier', cropId: 'processing-tomatoes', multiplier: 1.4, durationDays: 60 },
          { type: 'add_notification', message: 'Tomato prices surged! Processing tomato revenue increased by 40% for 60 days.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['market', 'tomatoes'],
  },

  {
    id: 'groundwater-pumping-ban',
    type: 'regulatory',
    title: 'Groundwater Pumping Ban',
    description: 'The state has imposed an emergency ban on groundwater pumping in your district due to critically low aquifer levels. You must decide how to handle the next 30 days without well water.',
    preconditions: [
      { type: 'season', season: 'summer' },
      { type: 'min_year', year: 5 },
      { type: 'random', probability: 0.12 },
    ],
    priority: 55,
    cooldownDays: 730,
    choices: [
      {
        id: 'comply',
        label: 'Comply with the Ban',
        description: 'No irrigation for 30 days. Your crops will rely on whatever moisture is in the soil.',
        effects: [
          { type: 'restrict_watering', durationDays: 30 },
          { type: 'add_notification', message: 'Groundwater pumping banned for 30 days. No irrigation available.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'buy-rights',
        label: 'Buy Surface Water Rights',
        description: 'Purchase surface water rights from the state. Costs $1,000 but keeps your irrigation running.',
        cost: 1000,
        requiresCash: 1000,
        effects: [
          { type: 'modify_cash', amount: -1000 },
          { type: 'add_notification', message: 'You purchased surface water rights for $1,000. Irrigation continues normally.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['regulatory', 'water', 'groundwater'],
  },

  // --- Slice 3a2: Orchard Decline Advisor ---

  {
    id: 'advisor-orchard-decline',
    type: 'advisor',
    title: 'Aging Orchard Assessment',
    description: "I've been looking at your older trees, and some of them are past their prime. Yields are declining and will continue to drop. It might be time to think about replanting — either with younger trees of the same variety, or something new entirely.",
    preconditions: [
      { type: 'has_declining_perennial' },
    ],
    priority: 90,
    cooldownDays: 730,
    maxOccurrences: 2,
    choices: [
      {
        id: 'plan-replacement',
        label: 'Plan Replacement',
        description: 'Get advice on timing and costs for replanting aging orchards.',
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"Removing old trees costs $400-500 per plot. Plan your replanting during the dormant season to minimize lost production.\"", notificationType: 'event_result' },
        ],
      },
      {
        id: 'keep-producing',
        label: 'Keep Them Going',
        description: 'Continue harvesting at reduced yields rather than investing in new trees.',
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"That's reasonable — even old trees produce some income. Just know that yields will keep dropping.\"", notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'perennials', 'decline'],
  },

  // --- 2c Advisor Events ---

  {
    id: 'advisor-soil-nitrogen',
    type: 'advisor',
    title: 'Soil Health Check',
    description: "I've been looking at the soil test results for your fields, and the nitrogen levels are getting low. Depleted soils mean weaker crops and lower yields. You have some options to restore fertility.",
    preconditions: [
      { type: 'min_year', year: 2 },
      { type: 'avg_nitrogen_below', level: 50 },
    ],
    priority: 100,
    cooldownDays: 365,
    maxOccurrences: 3,
    choices: [
      {
        id: 'buy-fertilizer',
        label: 'Apply Nitrogen Fertilizer',
        description: 'Purchase and apply commercial fertilizer to restore soil nitrogen. Quick results but costs money.',
        cost: 400,
        requiresCash: 400,
        effects: [
          { type: 'modify_cash', amount: -400 },
          { type: 'modify_nitrogen_all', amount: 60 },
          { type: 'add_notification', message: 'Dr. Santos helped you apply nitrogen fertilizer. Soil fertility improved.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'acknowledge',
        label: 'Thanks for the Heads Up',
        description: 'Take note and plan to rotate crops next season to rebuild soil health naturally.',
        effects: [
          { type: 'add_notification', message: 'Dr. Santos recommends planting winter wheat or another light feeder to restore nitrogen naturally.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'soil'],
  },

  {
    id: 'advisor-crop-failure',
    type: 'advisor',
    title: 'Crop Loss Review',
    description: "I noticed you've had some recent crop losses. That's tough, but it's a learning opportunity. Let's look at what happened and how to reduce risk going forward.",
    preconditions: [
      { type: 'consecutive_crop_failures', count: 1 },
    ],
    priority: 100,
    cooldownDays: 180,
    maxOccurrences: 5,
    choices: [
      {
        id: 'diversify-advice',
        label: 'Learn About Diversification',
        description: 'Dr. Santos explains how planting different crops reduces risk from weather and market swings.',
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"Don't put all your eggs in one basket. Mix crop types and planting times to spread risk.\"", notificationType: 'event_result' },
        ],
      },
      {
        id: 'water-advice',
        label: 'Get Irrigation Tips',
        description: 'Review your watering strategy to prevent moisture stress from contributing to future losses.',
        effects: [
          { type: 'add_notification', message: 'Dr. Santos reviewed your irrigation records and suggested watering more frequently during heat events.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'education'],
  },

  {
    id: 'advisor-chill-warning',
    type: 'advisor',
    title: 'Winter Chill Hour Concerns',
    description: "I've been tracking the chill hour data for our region, and the numbers are trending down. Your almond and pistachio trees need cold winter nights to produce well. If winters keep warming, you may see yield losses — especially for almonds, which need more chill hours than pistachios.",
    preconditions: [
      { type: 'any_perennial_planted' },
      { type: 'min_year', year: 8 },
    ],
    priority: 100,
    cooldownDays: 730,
    maxOccurrences: 2,
    choices: [
      {
        id: 'review-chill-data',
        label: 'Show Me the Data',
        description: 'Review the chill hour trends and what they mean for your orchard.',
        effects: [
          { type: 'set_flag', flag: 'chillHoursRevealed', value: true },
          { type: 'add_notification', message: 'Dr. Santos shared chill hour data for your region. You can now see chill hour tracking for your perennial crops.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'plan-adaptation',
        label: 'Help Me Plan Ahead',
        description: 'Get advice on which tree crops are more resilient to declining chill hours.',
        effects: [
          { type: 'set_flag', flag: 'chillHoursRevealed', value: true },
          { type: 'add_notification', message: "Dr. Santos: \"Pistachios need fewer chill hours than almonds. As winters warm, consider shifting toward more climate-resilient varieties.\"", notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'chill', 'climate'],
  },

  {
    id: 'advisor-drought-recovery',
    type: 'advisor',
    title: 'Financial Recovery Planning',
    description: "Times are tough, but I've seen farms recover from worse. Let's look at some strategies to rebuild your finances. The key is cutting costs where you can while keeping your most profitable acres producing.",
    preconditions: [
      { type: 'cash_below', amount: 30000 },
      { type: 'min_year', year: 4 },
    ],
    priority: 90,
    cooldownDays: 365,
    maxOccurrences: 3,
    choices: [
      {
        id: 'cost-cutting',
        label: 'Review Cost-Cutting Options',
        description: 'Focus on your most profitable crops and reduce planted acreage to match your budget.',
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"Focus on fewer, higher-value crops. It's better to farm 4 rows well than 8 rows poorly.\"", notificationType: 'event_result' },
        ],
      },
      {
        id: 'low-cost-crops',
        label: 'What Are the Cheapest Crops?',
        description: 'Learn which crops have the lowest input costs to help rebuild cash reserves.',
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"Winter wheat has the lowest seed and labor costs. It won't make you rich, but it keeps the farm running.\"", notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'finance'],
  },

  {
    id: 'advisor-perennial-opportunity',
    type: 'advisor',
    title: 'Long-Term Investment Opportunity',
    description: "Your farm is doing well financially, and you don't have any debt — that puts you in a great position. Have you considered planting tree crops? Almonds and pistachios require patience (3-4 years before they produce), but the long-term returns can be excellent.",
    preconditions: [
      { type: 'cash_above', amount: 40000 },
      { type: 'no_debt' },
      { type: 'no_perennial_planted' },
      { type: 'min_year', year: 3 },
    ],
    priority: 90,
    cooldownDays: 365,
    maxOccurrences: 1,
    choices: [
      {
        id: 'learn-perennials',
        label: 'Tell Me More',
        description: 'Learn about the costs, timeline, and potential returns of perennial tree crops.',
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"Almonds and pistachios cost $900-960 to plant and need 3-4 years to establish. But once producing, they generate strong annual income for 20+ years.\"", notificationType: 'event_result' },
        ],
      },
      {
        id: 'not-now',
        label: 'Not Right Now',
        description: "You're happy with your current crop plan.",
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"No rush. The option will be there when you're ready. Just remember — the best time to plant a tree was yesterday.\"", notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'perennials'],
  },
] as const;
