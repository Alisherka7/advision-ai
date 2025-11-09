from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class PeriodData(BaseModel):
    start: str  # ISO format datetime
    end: str  # ISO format datetime
    days: int


class SummaryData(BaseModel):
    total_viewers: int = Field(..., description="Total unique viewers (all time)")
    difference_total_viewers_percentage: int = Field(..., description="Percentage change in total viewers")
    total_new_viewers: int = Field(..., description="New viewers in the period")
    total_customers: int = Field(..., description="Total customers (users with multiple visits)")
    difference_total_customers_percentage: int = Field(..., description="Percentage change in total customers")
    average_view_time: int = Field(..., description="Average view time in minutes")
    difference_average_view_time: int = Field(..., description="Percentage change in average view time")


class DailyHistoryItem(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    day_of_week: str = Field(..., description="Day of week name")
    viewers: int = Field(..., description="Number of unique viewers on this day")
    customers: int = Field(..., description="Number of customers on this day")
    average_view_time: int = Field(..., description="Average view time in minutes")


class RankingItem(BaseModel):
    rank: int = Field(..., description="Ranking position based on unique viewers (top 1, 2, 3...)")
    billboard_id: str = Field(..., description="Billboard identifier")
    name: Optional[str] = Field(None, description="Billboard name")
    location: Optional[str] = Field(None, description="Billboard location")
    views: int = Field(..., description="Total number of views (detections)")
    visit_by_view: float = Field(..., description="Ratio of unique visitors to total views")
    viewing_duration: float = Field(..., description="Average viewing duration in minutes")


class AnalyticsData(BaseModel):
    summary: SummaryData
    daily_history: List[DailyHistoryItem]
    ranking: List[RankingItem] = Field(default_factory=list, description="Billboard rankings based on views")


class AnalyticsResponse(BaseModel):
    success: bool = True
    org_id: str
    period: PeriodData
    data: AnalyticsData

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "success": True,
            "org_id": "default_org",
            "period": {
                "start": "2025-11-01T00:00:00Z",
                "end": "2025-11-07T23:59:59Z",
                "days": 7
            },
            "data": {
                "summary": {
                    "total_viewers": 122,
                    "difference_total_viewers_percentage": 12,
                    "total_new_viewers": 40,
                    "total_customers": 10,
                    "difference_total_customers_percentage": 2,
                    "average_view_time": 123,
                    "difference_average_view_time": 12
                },
                "daily_history": [
                    {
                        "date": "2025-11-01",
                        "day_of_week": "Friday",
                        "viewers": 245,
                        "customers": 2,
                        "average_view_time": 28
                    }
                ],
                "ranking": [
                    {
                        "rank": 1,
                        "billboard_id": "billboard_gangnam",
                        "name": "Billboard Gangnam",
                        "location": "Gangnam Station",
                        "views": 150,
                        "visit_by_view": 0.75,
                        "viewing_duration": 5.5
                    }
                ]
            }
        }
    })

