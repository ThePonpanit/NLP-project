import { useState, useEffect } from "react";

import "./App.css";
import * as tf from "@tensorflow/tfjs";
import {
  Chart,
  DoughnutController,
  ArcElement,
  CategoryScale,
  Title,
  Tooltip,
} from "chart.js";
import { DishCard } from "./DishCard";
Chart.register(DoughnutController, ArcElement, CategoryScale, Title, Tooltip);

type DishType = {
  number: string;
  name: string;
  ingredients: string;
  preparation: string;
  calories: string;
  protein_g?: number;
  fat_total_g?: number;
  carbohydrates_total_g?: number;
  imageSrc?: string;
  normalizedValues?: number[];
  isLoadingNutrition?: boolean;
};

function App() {
  const [ingredients, setIngredients] = useState<string>("");
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [dishRecommendations, setDishRecommendations] = useState<DishType[]>(
    []
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const nutritionDataCache: Record<string, any> = {};

  async function retryWithBackoff(
    fn: Function,
    maxRetries: number = 3,
    delayMs: number = 1000
  ) {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries) {
          throw error;
        }
        await new Promise((res) => setTimeout(res, delayMs));
        delayMs *= 2; // Exponential back-off
      }
    }
  }

  const NUTRITION_API_ENDPOINT =
    "https://corsproxy.io/?" +
    encodeURIComponent("https://api.api-ninjas.com/v1/nutrition?query=");

  async function fetchNutritionData(query: string) {
    const response = await fetch(`${NUTRITION_API_ENDPOINT}${query}`, {
      method: "GET",
      headers: {
        "X-Api-Key": "xXRAKt1oyYc7DF9loKXZpQ==Pzw7DwvZrdduTxc6",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch nutrition data");
    }

    const data = await response.json();
    return data;
  }

  const fetchWithRetriesNutrition = (query: string) => {
    return retryWithBackoff(() => fetchNutritionData(query));
  };

  const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
  const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // prevent default form submission
    setHasStarted(true);
    setIsLoading(true);
    fetchFromGPT(ingredients);
  };

  const MAX_RETRIES = 3;

  const fetchFromGPT = async (ingredients: string, retries = 0) => {
    if (retries >= MAX_RETRIES) {
      console.error("Max retries reached. Unable to fetch matching dishes.");
      setIsLoading(false);
      return;
    }

    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a helpful cook assistant and be my Private Chef. 
                      I will tell you the ingredients and I want you the show me the menu that can be made with those ingredients and show me the estimated calories. 
                      I will give you the answer outline. Please follow the answer outline to ease regex matching.`,
          },
          {
            role: "user",
            content: `What dishes can I make with ${ingredients}?
                      Please list them in a structured manner with the dish name, preparation method, estimated calories.
                      Only give me 3 dishes.
                      And this is the answer outline:
                      Number of the dish:
                      Name of the dish:
                      Ingredients:
                      Preparation Method: 
                      Estimated Calories:`,
          },
        ],
      }),
    });

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    const dishPattern =
      /(?:number of the dish:|dish\d+)\s*(\d+)?[\s\S]+?Name of the dish:\s*([\s\S]+?)\s*Ingredients:\s*([\s\S]+?)\s*Preparation Method:\s*([\s\S]+?)\s*Estimated Calories:\s*([\s\S]+?)(?=(?:number of the dish:|dish\d+|$))/gi;

    const matches = [...assistantMessage.matchAll(dishPattern)];
    console.log("Matches:", matches);
    let dishes: DishType[] = [];

    try {
      for (const match of matches) {
        dishes.push({
          number: match[1]?.trim(),
          name: match[2]?.trim(),
          ingredients: match[3]?.trim(),
          preparation: match[4]?.trim(),
          calories: match[5]?.trim(),
        });
      }
    } catch (error) {
      console.error("Error processing the matches:", error);
      await fetchFromGPT(ingredients, retries + 1);
      return;
    }

    console.log("Extracted Dishes:", dishes);

    if (dishes.length === 0) {
      console.log("No dishes matched the pattern. Retrying...");
      await fetchFromGPT(ingredients, retries + 1);
    } else {
      dishes.forEach((dish) => (dish.isLoadingNutrition = true));
      setDishRecommendations(dishes);
      setIsLoading(false);
    }

    function cleanIngredients(ingredients: string): string {
      return ingredients
        .split("-") // Split by the dash
        .map((ing) => ing.trim()) // Trim each ingredient
        .filter((ing) => !ing.toLowerCase().includes("(to taste)")) // Remove ingredients that include "(to taste)"
        .join(","); // Join the cleaned ingredients with commas
    }

    // Fetch nutrition data for each dish recommendation
    dishes.forEach(async (dish) => {
      const cleanedIngredients = cleanIngredients(dish.ingredients);
      console.log("Cleaned Ingredients from GPT-3:", cleanedIngredients);

      let nutritionData;
      if (nutritionDataCache[cleanedIngredients]) {
        nutritionData = nutritionDataCache[cleanedIngredients];
      } else {
        nutritionData = await fetchWithRetriesNutrition(cleanedIngredients);
        nutritionDataCache[cleanedIngredients] = nutritionData; // Cache the fetched data
      }

      console.log("Nutrition Data:", nutritionData);

      if (nutritionData && nutritionData.length > 0) {
        const nutritionTensor = tf.tensor([
          nutritionData[0].calories,
          nutritionData[0].protein_g,
          nutritionData[0].fat_total_g,
          nutritionData[0].carbohydrates_total_g,
          // ... other nutritional values ...
        ]);

        const sum = nutritionTensor.sum();
        const normalizedTensor = nutritionTensor.div(sum);
        dish.normalizedValues = (await normalizedTensor.array()) as number[];

        console.log("Normalized Values:", dish.normalizedValues);
      }

      dish.isLoadingNutrition = false;

      // Trigger a re-render by updating the dishRecommendations state.
      setDishRecommendations((prevDishes) =>
        prevDishes.map((prevDish) =>
          prevDish.number === dish.number ? dish : prevDish
        )
      );
    });
  };

  useEffect(() => {
    console.log("Updated dishRecommendations:", dishRecommendations);
  }, [dishRecommendations]);

  return (
    <div>
      <form className="input-field" onSubmit={handleSubmit}>
        <input
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="Enter ingredients..."
        />
        <button type="submit" disabled={!ingredients.trim().length}>
          Get Dish Recommendation
        </button>
      </form>
      {!hasStarted ? (
        <div className="getting-started">
          <h1>Welcome to Dish Recommendation App</h1>

          <p className="step" style={{ marginTop: "20px", fontSize: "18px" }}>
            Enter your ingredients. (e.g. "chicken, rice, tomato")
          </p>
          <p className="step" style={{ fontSize: "18px" }}>
            Click on "Get Dish Recommendation" to begin.
          </p>
          <p className="step" style={{ fontSize: "18px" }}>
            We will give you the dish recommendation based on your ingredients.
          </p>
          <p className="step" style={{ fontSize: "18px" }}>
            Enjoy!
          </p>
        </div>
      ) : isLoading ? (
        <p style={{ fontSize: "25px" }}>
          Whipping up some delicious recommendations... Wait a sec! 🥘
        </p>
      ) : (
        dishRecommendations.map((dish, index) => (
          <DishCard key={index} dish={dish} delay={index * 500} />
        ))
      )}
    </div>
  );
}
export type DishCardProps = {
  dish: DishType;
  delay: number;
};

export default App;
