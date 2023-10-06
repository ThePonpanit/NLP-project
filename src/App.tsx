import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<string>("");
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  const [dishRecommendations, setDishRecommendations] = useState<
    {
      number: string;
      name: string;
      ingredients: string;
      preparation: string;
      calories: string;
    }[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
  const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

  const handleSubmit = async () => {
    setHasStarted(true);
    setIsLoading(true);

    try {
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
                I will give you the answer outline. plesae follow the answer outline to easy for regex match.`,
            },
            {
              role: "user",
              content: `What dishes can I make with ${ingredients}?
              Please list them in a structured manner with the dish name, preparation method, estimated calories.
              Only give me 3 dishes.
              and this is the answer Outline.
              number of the dish:
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
      console.log("Response:", assistantMessage);

      const dishPattern =
        /(?:number of the dish:|dish\d+)\s*(\d+)?[\s\S]+?Name of the dish:\s*([\s\S]+?)\s*Ingredients:\s*([\s\S]+?)\s*Preparation Method:\s*([\s\S]+?)\s*Estimated Calories:\s*([\s\S]+?)(?=(?:number of the dish:|dish\d+|$))/gi;

      const matches = [...assistantMessage.matchAll(dishPattern)];
      console.log("Matches:", matches);

      let dishes: {
        number: string;
        name: string;
        ingredients: string;
        preparation: string;
        calories: string;
      }[] = [];

      for (const match of matches) {
        dishes.push({
          number: match[1].trim(),
          name: match[2].trim(),
          ingredients: match[3].trim(),
          preparation: match[4].trim(),
          calories: match[5].trim(),
        });
      }

      console.log("Extracted Dishes:", dishes);

      if (dishes.length === 0) {
        // Split by double newlines to consider spaces between dishes
        const splitDishes = assistantMessage.split(/\n\s*\n/);

        for (let splitDish of splitDishes) {
          dishes.push({
            number: "",
            name: "Unknown Dish",
            ingredients: "",
            preparation: splitDish,
            calories: "",
          });
        }
      }

      setDishRecommendations(dishes);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
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

function DishCard({
  dish,
  delay,
}: {
  dish: {
    number: string;
    name: string;
    ingredients: string;
    preparation: string;
    calories: string;
    imageSrc?: string;
  };
  delay: number;
}) {
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
    </div>
  );
}

export default App;
