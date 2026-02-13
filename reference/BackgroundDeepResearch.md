# Background Deep Research — Climate Farmer Game Data & Formulas

> **DISCLAIMER: This document is REFERENCE MATERIAL ONLY, not a specification.**
> It was compiled for a previous attempt at this project that failed due to over-engineering
> and scope creep. Treat every number, formula, and suggestion here as "food for thought"
> that must be validated during the blueprint phase before adoption. Do NOT implement
> mechanics from this document without explicit approval from Neal. Many of these systems
> are far too detailed for a Classroom-Ready Build — the game should start with a tiny vertical slice
> (3 crops, 3 events, one complete loop) and only expand after that works in a classroom.
>
> **What's useful here:** Real-world data points, cited formulas, crop/soil/climate facts
> that can ground the simulation in reality — once we decide which subset to include.
>
> **What's dangerous here:** The sheer volume of mechanics implies a scope that would
> repeat the mistakes of the last attempt. Resist the urge to implement all of this.

---

## 1. Climate Adaptation Techniques

Modern farming adaptations can improve resilience to climate stresses while maintaining yields. Starting with *Project Drawdown* solutions and extending to California-specific practices:

- **Silvopasture:** Integrating trees with pasture for livestock. Trees provide shade (reducing heat stress on animals) and sequester carbon at high rates (~2.74 metric tons C/ha-year). Silvopasture can **increase soil water retention** (higher organic matter buffers drought) and diversify farm income (e.g. fruit, nuts, timber). It's shown to maintain or boost pasture productivity while storing **5–10x more carbon** than treeless pasture. In California, interest is growing (surveys of CA ranchers confirm perceived benefits in drought buffering and animal welfare).

- **No-Till / Conservation Farming:** Minimizing plowing to keep soil structure intact. This practice reduces erosion by **70% or more** (even up to ~98% in some studies), preventing loss of topsoil during heavy rain. It also preserves soil moisture by reducing evaporation. *Project Drawdown*'s conservation agriculture (crop rotation, cover crops, reduced tillage) sequesters ~0.25–0.78 t C/ha-year and makes land more resilient to droughts and floods. In California, no-till plus cover crops have shown increased soil organic matter, which drastically **boosts water-holding capacity** (1% more soil organic matter can enable soil to hold ~20,000 gallons more water per acre). Over time, no-till improves soil fertility and can cut fuel/labor costs (fewer tractor passes).

- **Cover Crops & Biochar:** Planting off-season cover crops (e.g. clover, vetch) adds organic matter and biologically fixes nitrogen. Legume covers can add on the order of **50–100 lbs nitrogen per acre** to the soil, reducing fertilizer needs. Deep-rooted covers also break up hardpan and improve infiltration. **Biochar** (charred biomass applied to soil) is another strategy – it increases soil carbon and water retention. Studies in California have found biochar can improve yields in degraded soils by improving nutrient retention and microbial activity. As an added benefit, biochar sequesters carbon in stable form for decades. For instance, **1 ton of biochar can sequester ~2–3 tons of CO2** (varying with feedstock).

- **Regenerative Grazing:** Managed grazing (rotational grazing with recovery periods) can regenerate grasslands. Trampling uneaten grass into soil and evenly distributing manure boosts soil organic matter and pasture health. Well-managed grazing can **sequester carbon** in soil (similar to other regenerative practices, often ~0.3–1.0 t C/ha-year). It also increases drought resilience by improving soil structure and water infiltration. California ranch trials have shown that adaptive grazing (moving cattle frequently) improves forage yield and reduces bare ground, lowering erosion.

- **AI-Driven Irrigation:** Precision irrigation systems using AI and sensors optimize water use. By monitoring soil moisture and weather forecasts, they water only as needed. On California farms, **AI-based irrigation has cut water use by up to ~30%** in some cases with no yield loss. Statewide adoption of advanced irrigation could save on the order of **1.3 trillion gallons** of water and billions of dollars.

- **Drone-Based Precision Fertilization:** Agricultural drones can apply fertilizers or pesticides precisely where needed. Studies indicate that **precision agriculture can reduce fertilizer and water use by ~20–40%** without hurting yields. Drones with multispectral cameras identify crop stress or nutrient deficiency in specific zones. Custom drone spraying services charge around **$7–$10 per acre**.

- **Drought-Tolerant Crop Varieties:** Shifting to crops or varieties that use less water. Farmers are experimenting with **alternative crops** like agave, sorghum, or millets. Agave can grow with *just ~3 inches of water per year* and survive extreme heat. **Sorghum** uses about **33% less water** than comparably grown corn or soy. Switching from high-value perennial crops to less thirsty annuals could cut farm water use by >90% statewide, but would reduce profits sharply — the game must balance economics vs. water savings.

- **Other Techniques:** Windbreaks, regenerative cropping (compost addition, crop rotation), integrated pest management (using natural predators and microclimate control), **cover crops** in orchards, and **dry-farming** (planting winter crops that rely solely on stored soil moisture).

## 2. Regional Climate Data & Uncertainty

California's diverse agricultural regions face increasing climate volatility.

**Extreme Heat & Changing Averages:** California has already warmed >1°F (many areas >2°F) in recent decades. By mid-century (~2050), average daily maximum temperatures are projected to rise **~4.4–5.8°F** (and **5.6–8.8°F by 2100**) under continued high emissions. Central Valley heat waves will be **~2 weeks longer by mid-century**. **Winter chill hours are declining** – more than half of Central Valley sites show significant drops in chill time needed for fruit/nut tree dormancy. By late-century, some regions may no longer reliably meet chill requirements for crops like cherries or some almond varieties.

**Drought Risk:** Even if annual rainfall stays around historical averages, **warmer temperatures will cause more intense and frequent droughts** through higher evaporation. The 2012–2016 drought was the state's worst in over a millennium. Climate models show **what used to be a 1-in-100 year extreme drought may occur far more often**. Human-caused warming has effectively **doubled the chance** that any given dry year is also extremely warm. By around **2030**, virtually *every* drought year is projected to be accompanied by extreme heat. In the last ~20 years, extreme weather caused **over $3 billion** in crop insurance payouts to California farmers. In 2021–22 many Central Valley farmers had to fallow land (over 750,000 acres idled).

**Flood & Storm Risk:** California's **weather whiplash** (swings between drought and flood) is intensifying. Climate change has **doubled the likelihood** of a catastrophic megaflood event. A 2022 UCLA study found further warming could **triple or quadruple** this risk by 2060. **Extreme precipitation events are about twice as likely** now as a century ago. The Jan 2023 atmospheric river storms caused ~$5–7 billion in flood damages.

**Wildfire Risk:** California's 2020 fire season: nearly **4.1 million acres burned**. Models project **+50% increase in the frequency of large fires** (>25,000 acres) and **+77% in average area burned by 2100**. Smoke taint ruined many winegrape harvests. Insurance for farm structures in wildfire-prone areas is becoming costlier or unavailable.

**Water Supply & Snowpack:** Sierra snowpack could decline **>30% by 2050 and >50% by 2100**. Even with the same annual precipitation, earlier runoff and smaller snow reserves will force changes in storage and groundwater use.

**Summary of Regional Impacts:**
- *Central Valley:* Hotter summers, less reliable irrigation deliveries. By 2035, models suggest 5–10% yield loss for key crops due to heat alone.
- *Central Coast:* Cooler coastal climate buffers heat, but warming oceans may disrupt fog patterns. Pest pressures from milder winters. Sea level rise threatens coastal fields.
- *Southern Desert (Imperial/Coachella):* Extreme heat becoming even more extreme. Water supply from Colorado likely declining ~5–20% by mid-century.
- *Northern & Foothill Regions:* Warming allows some new crops but increases wildfire and pest ranges. Chilling hours for nuts declining significantly.

## 3. Crop & Soil Impact Modeling

**Major Crops by Region:**

- **Central Valley:** Almonds (~4.5 af/ac water), pistachios (~4+ af/ac, more salt-tolerant), walnuts, peaches, olives, grapes (~2.8 af/ac), citrus (~4.2 af/ac), cotton (~3.7 af/ac), alfalfa (~4.5 af/ac), corn (~2.5 af/ac), rice. Adaptive alternatives: sorghum (1/3 less water than corn), olives, pomegranates, agave (experimental).

- **Central Coast:** Lettuce, spinach, celery, strawberries, broccoli/cauliflower. 2–3 crop cycles per year. Controlled environment agriculture emerging.

- **Southern Desert (Imperial/Coachella):** Winter lettuce, broccoli, melons, alfalfa, cotton, dates, citrus. Adaptive: sorghum, tepary beans, guayule.

- **Foothill/Northern:** Wine grapes, olives, walnuts, rice, cattle grazing.

**Soil Nutrient Cycling & Fertility:**
- *Nutrient Removal:* A 200 bu/acre corn crop takes up ~200 lbs nitrogen, ~35–40 lbs P2O5, 50–60 lbs K2O.
- *Fertilizer efficiency:* About 50% of applied N may be taken up by crops; the rest leaches or stays in organic matter.
- *Legume Cover Crops:* Can add ~50–100 lbs N/acre to the next crop.
- *Soil Organic Matter:* 1–3% of soil organic N becomes available each year. More OM = less fertilizer needed and better yield resilience.

**Soil Erosion:**
- USLE: **A = R x K x L x S x C x P** (rainfall erosivity x soil erodibility x slope length x steepness x cover management x conservation practice)
- No-till can reduce erosion by 70–90%.
- Cover crops reduce USLE C factor from 1.0 (bare) to ~0.1 or less.

**Soil Water:**
- Every +1% organic matter holds ~20,000 extra gallons/acre.
- Irrigation efficiency: flood ~60%, drip ~90%.
- Daily soil water balance: SoilMoisture = SoilMoisture + Rain/Irrigation - ET - Runoff/Drainage
- ET = Kc x ET0 (crop coefficient x reference evapotranspiration)

**Yield Response to Water (FAO formula):**
```
1 - Y/Ymax = Ky * (1 - ETactual/ETmax)
```
Where Ky is crop-specific: >1 for sensitive crops, ~1 for moderate, <1 for drought-tolerant.

**Growing Degree Days:**
```
GDD_day = max((Tmax + Tmin)/2 - Tbase, 0)
```
Base 50°F for warm-season crops, 40°F for cool-season. Crops need a cumulative GDD sum to mature.

## 4. Economic Data for Farming

**Typical Production Costs (per acre):**
- Land rent: ~$750 (prime irrigated)
- Seeds: $30–$150 (varies by crop)
- Orchard establishment: ~$960 upfront for almonds (120 trees x $8), amortized over 25 years
- Labor: $16/hr (CA minimum), farmworkers eligible for overtime
  - Mechanized field crops: <5 hours/acre/season
  - Strawberries: ~200–300+ hours/acre for harvest
  - Almonds: ~$325/ac for harvest (mostly mechanized)
- Equipment: ~$277/ac (fuel, repairs, depreciation — almond example)
- Water: $50–$200/af (surface), $148/af pumping from 200ft depth, >$1000/af in drought spot market
- Drip irrigation install: ~$1000/ac, lasts ~10 years
- Nitrogen fertilizer: ~$0.50/lb N
- Drones: $2,000–$5,000 to buy, or ~$7.50/ac for service
- Crop insurance premiums: ~5% of crop value

**Crop Prices & Revenue:**
- Climate events cause price spikes: lettuce prices jumped 3–5x during 2022 shortage
- Trade wars: China tariffs cost CA almond industry ~$755 million in lost exports
- Labor shortages can leave crops unharvested (total loss)

**Economic Modeling:**
```
Revenue = sum(Yield_per_acre x Price x Acres) for each crop
Expenses = sum(costs_per_acre x acres) + overhead
Profit = Revenue - Expenses
```

## 5. Farm Simulation Formulas & Models

**Water Balance (Daily):**
```
M(t+1) = M(t) + Irrigation + Rain - ET - Drainage
ET = Kc x ET0
```

**Yield Response to Water:**
```
1 - Y/Ymax = Ky * (1 - ETactual/ETfull)
```

**Growing Degree Days:**
```
GDD = max((Tmax + Tmin)/2 - Tbase, 0)
```

**Nutrient Budget (Nitrogen example):**
```
N_soil_new = N_soil_old + N_fertilizer + N_fixation - N_uptake - N_leached
```

**Soil Organic Matter (Annual):**
```
delta_OM = inputs(residues, compost) - decomposition(k x OM)
k ~ 2-4%/year depending on climate
1% OM ~ 20,000 gal/ac water holding + ~20-30 lb N/ac/yr mineralized
```

**Soil Erosion (USLE, Annual):**
```
A = R x K x LS x C x P (tons/acre/year)
```

**Economic:**
```
NPV = sum(CashFlow_t / (1+r)^t)
Interest = Debt x rate
```

## 6. Game-Ready JSON Format (Starting Point)

> **Note:** This JSON was drafted for the previous attempt. It should be reviewed,
> simplified, and validated against our actual Classroom-Ready Build scope before use. Most of this
> data will NOT be needed for the first vertical slice.

```json
{
  "climate": {
    "regions": {
      "Central Valley": {
        "temp_increase_F": { "2050": 5.0, "2100": 7.0 },
        "heatwaves_midCentury": "2 weeks longer",
        "drought_chance": { "2025": 0.1, "2035": 0.15, "2050": 0.2 },
        "flood_chance": { "2025": 0.05, "2035": 0.1, "2050": 0.15 },
        "snowpack_decline": { "2050": 0.33, "2100": 0.5 }
      },
      "Central Coast": {
        "temp_increase_F": { "2050": 3.0 },
        "drought_chance": { "2050": 0.1 },
        "flood_chance": { "2050": 0.2 }
      },
      "Imperial Valley": {
        "temp_increase_F": { "2050": 6.0 },
        "drought_chance": { "2050": 0.5 },
        "flood_chance": { "2050": 0.05 }
      }
    },
    "extremes": {
      "megaflood_2060_probability": 0.5,
      "wildfire_area_increase_2100": 0.77
    }
  },
  "crops": [
    {
      "name": "Almonds",
      "type": "perennial",
      "water_use_af_per_acre": 4.5,
      "gdd_base_F": 50,
      "gdd_to_maturity": 3000,
      "yield_potential": 2500,
      "yield_units": "lbs_acre",
      "price_per_unit": 2.5,
      "labor_hours_per_acre": 40,
      "Ky": 1.1,
      "winter_chill_requirement_hours": 700
    },
    {
      "name": "Lettuce",
      "type": "annual",
      "water_use_af_per_acre": 1.5,
      "gdd_base_F": 40,
      "gdd_to_maturity": 800,
      "yield_potential": 800,
      "yield_units": "cartons_acre",
      "price_per_unit": 20,
      "labor_hours_per_acre": 120,
      "Ky": 1.05
    },
    {
      "name": "Sorghum",
      "type": "annual",
      "water_use_af_per_acre": 3.0,
      "gdd_base_F": 50,
      "gdd_to_maturity": 2500,
      "yield_potential": 100,
      "yield_units": "bu_acre",
      "price_per_unit": 6,
      "labor_hours_per_acre": 5,
      "Ky": 0.8
    }
  ],
  "soil": {
    "organic_matter_percent": 2.0,
    "available_water_capacity_in": 6.0,
    "erosion_rate_t_ac_year": 0.5,
    "nutrients": { "N_lb_ac": 100, "P_lb_ac": 30, "K_lb_ac": 300 }
  },
  "adaptation_techniques": {
    "no_till": {
      "erosion_reduction": 0.8,
      "om_increase_per_year": 0.1,
      "fuel_use_reduction": 0.5
    },
    "cover_crop": {
      "N_fixation_lb_ac": 50,
      "erosion_reduction": 0.5,
      "soil_water_hold_increase": 0.5
    },
    "drip_irrigation": {
      "water_use_efficiency": 0.9,
      "yield_gain_percent": 0.05
    },
    "ai_irrigation": {
      "water_savings_percent": 0.25,
      "energy_savings_percent": 0.1
    },
    "drones_precision": {
      "fertilizer_savings_percent": 0.30,
      "pesticide_savings_percent": 0.30,
      "yield_gain_percent": 0.02
    }
  },
  "economics": {
    "costs_per_acre": {
      "land_rent": 750,
      "labor_wage_per_hour": 16,
      "fuel_per_gal": 4,
      "water_per_af": 100,
      "nitrogen_per_lb": 0.5,
      "insurance_premium_percent": 0.05
    },
    "market_prices": {
      "almonds_per_lb": 2.50,
      "lettuce_per_carton": 20.00,
      "sorghum_per_bu": 6.00
    }
  }
}
```
