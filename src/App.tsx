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
};

function App() {
  const [ingredients, setIngredients] = useState<string>("");
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [dishRecommendations, setDishRecommendations] = useState<DishType[]>(
    []
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const NUTRITION_API_ENDPOINT =
    "https://api.api-ninjas.com/v1/nutrition?query=";

  async function fetchNutritionData(query: string) {
    try {
      const response = await fetch(`${NUTRITION_API_ENDPOINT}${query}`, {
        method: "GET",
        mode: "no-cors",
        cache: "no-cache",
        credentials: "same-origin",
        headers: {
          "X-Api-Key": "xXRAKt1oyYc7DF9loKXZpQ==Pzw7DwvZrdduTxc6",
          "Content-Type": "application/json",
        },
      });

      if (response.type === "opaque") {
        console.warn("Request sent using 'no-cors', unable to read the data.");
        return null; // You can't process or handle the data here because it's opaque.
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching nutrition data:", error);
      return null;
    }
  }

  const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
  const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

  const handleSubmit = () => {
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
      setDishRecommendations(dishes);
      setIsLoading(false);
    }

    // Fetch nutrition data for each dish recommendation
    const updatedDishes = await Promise.all(
      dishes.map(async (dish) => {
        const ingredientsList = dish.ingredients.split(",").join(" and "); // Convert comma-separated ingredients to "and" separated.
        const nutritionData = await fetchNutritionData(ingredientsList);
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

        return dish;
      })
    );

    setDishRecommendations(updatedDishes);
  };

  useEffect(() => {
    console.log("Updated dishRecommendations:", dishRecommendations);
  }, [dishRecommendations]);

  return (
    <div>
      <div className="input-field">
        <input
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="Enter ingredients..."
        />
        <button onClick={handleSubmit} disabled={!ingredients.trim().length}>
          Get Dish Recommendation
        </button>
      </div>
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
type DishCardProps = {
  dish: DishType;
  delay: number;
};

function DishCard({ dish, delay }: DishCardProps) {
  const [fetchedImageSrc, setFetchedImageSrc] = useState<string | null>(null);
  const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const response = await fetch(
          `https://api.unsplash.com/search/photos?page=1&query=${dish.name}&client_id=${UNSPLASH_ACCESS_KEY}`
        );
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          setFetchedImageSrc(data.results[0].urls.small);
        }
      } catch (error) {
        console.error("Error fetching the image:", error);
      }
    };
    fetchImage();
  }, [dish.name]);

  useEffect(() => {
    const labels = ["Calories", "Protein", "Fat", "Carbs"];

    const ctx = (
      document.getElementById(`chart-${dish.number}`) as HTMLCanvasElement
    )?.getContext("2d");

    if (!ctx) {
      console.warn("Canvas context not available. Skipping chart generation.");
      return;
    }

    const dataToDisplay = dish.normalizedValues || [
      // Use normalized values if available
      parseFloat(dish.calories),
      dish.protein_g || 0,
      dish.fat_total_g || 0,
      dish.carbohydrates_total_g || 0,
    ];

    console.log("Data for Chart:", dataToDisplay);

    const chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: dataToDisplay,
            backgroundColor: ["#FF9999", "#66B2FF", "#99E699", "#FFCC66"],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: "Nutritional Breakdown",
          },
          legend: {
            display: true, // this will show the legend
            position: "right", // position of the legend (can be 'top', 'left', 'bottom', 'right')
          },
        },
      },
    });

    // Cleanup the chart when component is unmounted
    return () => chart.destroy();
  }, [dish]);

  const preparationSteps = dish.preparation.split(/\n/).filter(Boolean);

  return (
    <div className="cardStyle" style={{ animationDelay: `${delay}ms` }}>
      {fetchedImageSrc && (
        <div className="imageContainerStyle">
          <img
            src={fetchedImageSrc}
            alt={dish.name}
            style={{
              width: "350px",
              height: "300px",
              objectFit: "cover",
              boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.2)",
              borderRadius: "10px",
            }}
          />
        </div>
      )}
      <h2>{dish.name}</h2>
      <h3>Ingredients:</h3>
      <p>{dish.ingredients}</p>
      <h3>Preparation Method:</h3>
      <ul>
        {preparationSteps.map((step, index) => (
          <li key={index}>{step.trim()}</li>
        ))}
      </ul>
      <h3>Estimated Calories:</h3>
      <p>{dish.calories}</p>
      <div>
        <canvas
          id={`chart-${dish.number}`}
          key={dish.normalizedValues?.join("-")}
          // width="150"
          // height="150"
        ></canvas>
      </div>
    </div>
  );
}

export default App;
