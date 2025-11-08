
"use client"

import { ForwardRefExoticComponent, RefAttributes } from "react"
import {
  type Icon,
  IconArrowNarrowRight,
  IconDots,
  IconProps,
  IconEye,
  IconShoppingCart,
  IconClock,
} from "@tabler/icons-react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AnalyticsResponse {
  success: boolean
  org_id: string
  period: {
    start: string
    end: string
    days: number
  }
  data: {
    summary: {
      total_viewers: number
      difference_total_viewers_percentage: number
      total_new_viewers: number
      total_customers: number
      difference_total_customers_percentage: number
      average_view_time: number
      difference_average_view_time: number
    }
    daily_history: Array<{
      date: string
      day_of_week: string
      viewers: number
      customers: number
      average_view_time: number
    }>
    ranking: Array<{
      rank: number
      billboard_id: string
      name: string | null
      location: string | null
      views: number
      visit_by_view: number
      viewing_duration: number
    }>
  }
}

interface StatsData {
  label: string
  stats: number
  type: "up" | "down"
  percentage: number
  profit: number
  icon: ForwardRefExoticComponent<IconProps & RefAttributes<Icon>>
  sign?: "money" | "number"
}

interface StatsProps {
  analyticsData: AnalyticsResponse
}

export default function Stats({ analyticsData }: StatsProps) {
  // Calculate profit values (using total_new_viewers as profit for viewers, similar logic for others)
  const viewersProfit = analyticsData.data.summary.total_new_viewers
  const customersProfit = analyticsData.data.summary.total_customers
  const avgViewTimeProfit = analyticsData.data.summary.average_view_time

  // Map API response to stats format
  const statsData: StatsData[] = [
    {
      label: "Total Attention / Eye contact",
      stats: analyticsData.data.summary.total_viewers,
      type: analyticsData.data.summary.difference_total_viewers_percentage >= 0 ? "up" : "down",
      percentage: Math.abs(analyticsData.data.summary.difference_total_viewers_percentage),
      profit: viewersProfit,
      icon: IconEye,
      sign: "number",
    },
    {
      label: "Focus duration",
      stats: analyticsData.data.summary.average_view_time,
      type: analyticsData.data.summary.difference_average_view_time >= 0 ? "up" : "down",
      percentage: Math.abs(analyticsData.data.summary.difference_average_view_time),
      profit: avgViewTimeProfit,
      icon: IconClock,
      sign: "number",
    },
    {
      label: "Conversion (became customer)",
      stats: analyticsData.data.summary.total_customers,
      type: analyticsData.data.summary.difference_total_customers_percentage >= 0 ? "up" : "down",
      percentage: Math.abs(analyticsData.data.summary.difference_total_customers_percentage),
      profit: customersProfit,
      icon: IconShoppingCart,
      sign: "number",
    },
  ]

  return (
    <>
      <div className="col-span-6 grid grid-cols-6 gap-4">
        {statsData.map((stats) => (
          <div key={stats.label} className="col-span-3">
            <StatsCard key={stats.label} {...stats} />
          </div>
        ))}
      </div>
    </>
  )
}

function StatsCard({
  label,
  icon: Icon,
  type,
  sign = "number",
  stats,
  percentage,
  profit,
}: StatsData) {
  return (
    <Card className="h-full w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <div className="bg-opacity-25 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600">
            <Icon className="text-indigo-100" size={14} />
          </div>
          <span>{label}</span>
        </CardTitle>
        <IconDots className="cursor-pointer opacity-60" size={16} />
      </CardHeader>
      <CardContent className="space-y-[10px] px-4 pt-0 pb-4">
        <p className="text-2xl font-bold">
          {sign === "money" && "$"}
          {stats.toLocaleString()}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={cn("flex items-center gap-1", {
              "text-emerald-400": type === "up",
              "text-red-400": type === "down",
            })}
          >
            {type === "up" ? (
              <ArrowUpRight size={16} />
            ) : (
              <ArrowDownRight size={16} />
            )}
            <p className="text-xs font-bold">{percentage.toLocaleString()}%</p>
          </div>
          <p className="text-muted-foreground text-xs font-normal">
            {type === "up" ? "+" : "-"}
            {profit.toLocaleString()} today
          </p>
        </div>
        <div className="bg-muted-foreground h-[0.04px] w-full opacity-50" />

        <div className="flex items-center gap-2">
          <p className="text-xs font-medium">View Report</p>
          <IconArrowNarrowRight size={18} />
        </div>
      </CardContent>
    </Card>
  )
}