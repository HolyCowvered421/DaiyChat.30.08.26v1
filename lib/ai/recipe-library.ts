export const STANDARD_RECIPE_LIBRARY = [
  {
    name: 'Protein Overnight Oats',
    meal_type: 'breakfast',
    calories: 420,
    protein: 32,
    carbs: 42,
    fat: 10,
    ingredients: ['Haferflocken', 'Griechischer Joghurt', 'Mandelmilch', 'Bananen', 'Chiasamen'],
  },
  {
    name: 'Avocado Egg Bowl',
    meal_type: 'breakfast',
    calories: 390,
    protein: 25,
    carbs: 18,
    fat: 22,
    ingredients: ['Spiegeleier', 'Avocado', 'Tomaten', 'Feta', 'Salatblätter'],
  },
  {
    name: 'Chicken Quinoa Bowl',
    meal_type: 'lunch',
    calories: 560,
    protein: 42,
    carbs: 48,
    fat: 18,
    ingredients: ['Hähnchenbrust', 'Quinoa', 'Brokkoli', 'Kichererbsen', 'Zitronen-Dressing'],
  },
  {
    name: 'Salmon Rice Plate',
    meal_type: 'lunch',
    calories: 610,
    protein: 38,
    carbs: 52,
    fat: 24,
    ingredients: ['Lachs', 'Reis', 'Spinat', 'Erbsen', 'Sesam'],
  },
  {
    name: 'Tofu Veggie Stir-Fry',
    meal_type: 'dinner',
    calories: 520,
    protein: 30,
    carbs: 45,
    fat: 18,
    ingredients: ['Tofu', 'Brokkoli', 'Paprika', 'Sojasauce', 'Basmatireis'],
  },
  {
    name: 'Turkey Chili',
    meal_type: 'dinner',
    calories: 600,
    protein: 46,
    carbs: 40,
    fat: 20,
    ingredients: ['Putenhack', 'Tomaten', 'Kichererbsen', 'Paprika', 'Zwiebeln'],
  },
  {
    name: 'Greek Yogurt Snack Bowl',
    meal_type: 'snack',
    calories: 240,
    protein: 24,
    carbs: 16,
    fat: 8,
    ingredients: ['Griechischer Joghurt', 'Beeren', 'Walnüsse', 'Honig'],
  },
  {
    name: 'Lentil Curry',
    meal_type: 'dinner',
    calories: 540,
    protein: 28,
    carbs: 55,
    fat: 16,
    ingredients: ['Linsen', 'Kokosmilch', 'Kürbis', 'Currypulver', 'Basmatireis'],
  },
  {
    name: 'Egg White Omelette',
    meal_type: 'breakfast',
    calories: 330,
    protein: 29,
    carbs: 12,
    fat: 12,
    ingredients: ['Eiweiß', 'Spinat', 'Tomaten', 'Pilze', 'Parmesan'],
  },
  {
    name: 'Lean Beef Power Salad',
    meal_type: 'lunch',
    calories: 580,
    protein: 44,
    carbs: 35,
    fat: 21,
    ingredients: ['Mageres Rindfleisch', 'Römersalat', 'Kartoffeln', 'Tomaten', 'Avocado'],
  },
];

export function buildRecipeLibraryContext(limit = 8) {
  return STANDARD_RECIPE_LIBRARY.slice(0, limit)
    .map(
      (recipe) => `${recipe.name} (${recipe.meal_type}, ${recipe.calories} kcal, ${recipe.protein}g Protein, ${recipe.carbs}g Kohlenhydrate, ${recipe.fat}g Fett)`
    )
    .join('; ');
}
