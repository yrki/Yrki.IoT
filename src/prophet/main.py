from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from prophet import Prophet
import pandas as pd
import numpy as np
import logging

logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

app = FastAPI(title="Yrki IoT Prophet Service")


class DataPoint(BaseModel):
    ds: str
    y: float


class ForecastRequest(BaseModel):
    history: list[DataPoint]
    periods: int
    freq: str = "h"
    mode: str = "default"


class ForecastPoint(BaseModel):
    ds: str
    yhat: float
    yhat_lower: float
    yhat_upper: float


class ForecastResponse(BaseModel):
    forecast: list[ForecastPoint]


@app.get("/health")
def health():
    return {"status": "ok"}


def build_model_default(df: pd.DataFrame) -> tuple[Prophet, pd.DataFrame]:
    model = Prophet(
        growth="flat",
        daily_seasonality=True,
        weekly_seasonality=len(df) >= 168,
        yearly_seasonality=False,
        changepoint_prior_scale=0.05,
    )
    model.fit(df)
    return model, df


def build_model_bounded(df: pd.DataFrame) -> tuple[Prophet, pd.DataFrame]:
    y_min = df["y"].min()
    y_max = df["y"].max()
    y_range = y_max - y_min if y_max > y_min else 1.0
    margin = y_range * 0.2

    cap = y_max + margin
    floor = max(0, y_min - margin)

    df = df.copy()
    df["cap"] = cap
    df["floor"] = floor

    model = Prophet(
        growth="logistic",
        daily_seasonality=True,
        weekly_seasonality=len(df) >= 168,
        yearly_seasonality=False,
        changepoint_prior_scale=0.01,
        seasonality_mode="multiplicative",
    )
    model.fit(df)
    return model, df


def build_model_monotonic(df: pd.DataFrame) -> tuple[Prophet, pd.DataFrame]:
    model = Prophet(
        growth="linear",
        daily_seasonality=False,
        weekly_seasonality=False,
        yearly_seasonality=False,
        changepoint_prior_scale=0.01,
        seasonality_mode="additive",
    )
    model.fit(df)
    return model, df


@app.post("/forecast", response_model=ForecastResponse)
def forecast(request: ForecastRequest):
    if len(request.history) < 2:
        raise HTTPException(status_code=400, detail="At least 2 data points required")

    df = pd.DataFrame([{"ds": p.ds, "y": p.y} for p in request.history])
    df["ds"] = pd.to_datetime(df["ds"], utc=True).dt.tz_localize(None)

    if request.mode == "bounded":
        model, df = build_model_bounded(df)
    elif request.mode == "monotonic":
        model, df = build_model_monotonic(df)
    else:
        model, df = build_model_default(df)

    future = model.make_future_dataframe(periods=request.periods, freq=request.freq)

    if request.mode == "bounded":
        future["cap"] = df["cap"].iloc[0]
        future["floor"] = df["floor"].iloc[0]

    result = model.predict(future)

    last_historical = df["ds"].max()
    forecast_only = result[result["ds"] > last_historical].copy()

    if request.mode == "monotonic":
        last_value = df["y"].iloc[-1]
        forecast_only["yhat"] = forecast_only["yhat"].clip(lower=last_value)
        forecast_only["yhat"] = forecast_only["yhat"].cummax()
        forecast_only["yhat_lower"] = forecast_only["yhat_lower"].clip(lower=last_value)
        forecast_only["yhat_upper"] = forecast_only["yhat_upper"].clip(lower=last_value)

    points = [
        ForecastPoint(
            ds=row["ds"].isoformat() + "Z",
            yhat=round(row["yhat"], 4),
            yhat_lower=round(row["yhat_lower"], 4),
            yhat_upper=round(row["yhat_upper"], 4),
        )
        for _, row in forecast_only.iterrows()
    ]

    return ForecastResponse(forecast=points)
