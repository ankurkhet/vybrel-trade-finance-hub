// SIC code prefix → industry mapping for auto-selection
const SIC_INDUSTRY_MAP: Record<string, string> = {
  "01": "agriculture_&_farming", "02": "agriculture_&_farming", "03": "agriculture_&_farming",
  "05": "mining_&_metals", "06": "mining_&_metals", "07": "mining_&_metals", "08": "mining_&_metals", "09": "mining_&_metals",
  "10": "food_&_beverage", "11": "food_&_beverage", "12": "food_&_beverage",
  "13": "textiles_&_apparel", "14": "textiles_&_apparel", "15": "textiles_&_apparel",
  "16": "manufacturing", "17": "manufacturing", "18": "manufacturing",
  "19": "energy_&_utilities", "20": "manufacturing", "21": "manufacturing", "22": "manufacturing",
  "23": "manufacturing", "24": "manufacturing", "25": "manufacturing", "26": "manufacturing",
  "27": "manufacturing", "28": "manufacturing", "29": "automotive", "30": "automotive",
  "31": "manufacturing", "32": "manufacturing", "33": "manufacturing",
  "35": "energy_&_utilities", "36": "energy_&_utilities",
  "38": "professional_services",
  "41": "construction_&_real_estate", "42": "construction_&_real_estate", "43": "construction_&_real_estate",
  "45": "automotive", "46": "consumer_goods_&_retail", "47": "consumer_goods_&_retail",
  "49": "logistics_&_transportation", "50": "logistics_&_transportation", "51": "logistics_&_transportation",
  "52": "logistics_&_transportation", "53": "logistics_&_transportation",
  "55": "hospitality_&_tourism", "56": "food_&_beverage",
  "58": "entertainment_&_media", "59": "entertainment_&_media", "60": "entertainment_&_media",
  "61": "telecommunications", "62": "information_technology", "63": "information_technology",
  "64": "banking_&_financial_services", "65": "insurance", "66": "banking_&_financial_services",
  "68": "construction_&_real_estate",
  "69": "professional_services", "70": "professional_services", "71": "professional_services",
  "72": "professional_services", "73": "professional_services", "74": "professional_services",
  "75": "professional_services",
  "77": "professional_services", "78": "professional_services",
  "79": "hospitality_&_tourism", "80": "education_&_training",
  "82": "professional_services",
  "84": "professional_services", "85": "education_&_training",
  "86": "healthcare_&_pharmaceuticals", "87": "healthcare_&_pharmaceuticals", "88": "healthcare_&_pharmaceuticals",
  "90": "entertainment_&_media", "91": "entertainment_&_media", "92": "entertainment_&_media", "93": "entertainment_&_media",
  "94": "professional_services", "95": "professional_services", "96": "professional_services",
};

export function sicToIndustry(sicCodes: string): string | null {
  // Extract first SIC code's 2-digit prefix
  const match = sicCodes.match(/(\d{2})/);
  if (!match) return null;
  return SIC_INDUSTRY_MAP[match[1]] || null;
}
