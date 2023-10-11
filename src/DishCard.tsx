import { useState, useEffect, useRef } from "react";
import { Chart } from "chart.js";
import { DishCardProps } from "./App";

export function DishCard({ dish, delay }: DishCardProps) {
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

  type NutritionChartProps = {
    data: number[];
    dishNumber: string;
  };

  function NutritionChart({ data, dishNumber }: NutritionChartProps) {
    const chartRef = useRef<Chart | null>(null);
    const percentages = data.map((value) => (value * 100).toFixed(2) + "%"); // Convert normalized values to percentages
    const labels = ["Calories", "Protein", "Fat", "Carbs"];
    const labeledPercentages = labels.map(
      (label, idx) => `${label}: ${percentages[idx]}`
    );

    console.log("Percentages:", percentages);

    useEffect(() => {
      // Destroy the previous instance of the chart, if it exists
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = (
        document.getElementById(`chart-${dishNumber}`) as HTMLCanvasElement
      )?.getContext("2d");

      if (!ctx) {
        console.warn(
          "Canvas context not available. Skipping chart generation."
        );
        return;
      }

      chartRef.current = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Calories", "Protein", "Fat", "Carbs"],
          datasets: [
            {
              data: data.map((value) => parseFloat((value * 100).toFixed(2))), // Convert the percentages back to float values for the chart
              backgroundColor: ["#FF9999", "#66B2FF", "#99E699", "#FFCC66"],
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text:
                "Nutritional Breakdown (" + labeledPercentages.join(", ") + ")",
              font: {
                size: 15, // Adjust this to your desired size
              },
            },
            legend: {
              display: true,
              position: "right",
            },
          },
        },
      }) as Chart;

      // Cleanup the chart when component is unmounted
      return () => {
        if (chartRef.current) {
          chartRef.current.destroy();
        }
      };
    }, [data, dishNumber]);

    return <canvas id={`chart-${dishNumber}`} key={data.join("-")}></canvas>;
  }

  const preparationSteps = dish.preparation.split(/\n/).filter(Boolean);

  return (
    <div className="cardStyle" style={{ animationDelay: `${delay}ms` }}>
      {fetchedImageSrc && (
        <div className="imageContainerStyle">
          <img
            src={fetchedImageSrc}
            alt={dish.name}
            style={{
              width: "450px",
              height: "400px",
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
        {dish.normalizedValues && (
          <NutritionChart
            data={dish.normalizedValues}
            dishNumber={dish.number}
          />
        )}
      </div>
    </div>
  );
}
