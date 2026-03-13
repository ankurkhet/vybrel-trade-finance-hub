import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

type ChartType = "bar" | "line" | "pie";

interface ReportChartProps {
  title: string;
  data: Record<string, unknown>[];
  type?: ChartType;
  dataKeys: { key: string; color: string; label?: string }[];
  xAxisKey?: string;
  className?: string;
  height?: number;
}

const COLORS = [
  "hsl(217, 91%, 40%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(199, 89%, 48%)",
  "hsl(0, 84%, 60%)",
];

export function ReportChart({ title, data, type = "bar", dataKeys, xAxisKey = "name", className, height = 300 }: ReportChartProps) {
  return (
    <Card className={cn("animate-fade-in", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey={xAxisKey} className="text-xs" tick={{ fill: "hsl(215, 16%, 47%)" }} />
              <YAxis className="text-xs" tick={{ fill: "hsl(215, 16%, 47%)" }} />
              <Tooltip contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(214, 32%, 91%)", borderRadius: "8px" }} />
              <Legend />
              {dataKeys.map((dk) => (
                <Bar key={dk.key} dataKey={dk.key} fill={dk.color} name={dk.label || dk.key} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          ) : type === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey={xAxisKey} className="text-xs" tick={{ fill: "hsl(215, 16%, 47%)" }} />
              <YAxis className="text-xs" tick={{ fill: "hsl(215, 16%, 47%)" }} />
              <Tooltip contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(214, 32%, 91%)", borderRadius: "8px" }} />
              <Legend />
              {dataKeys.map((dk) => (
                <Line key={dk.key} type="monotone" dataKey={dk.key} stroke={dk.color} name={dk.label || dk.key} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          ) : (
            <PieChart>
              <Pie data={data} dataKey={dataKeys[0]?.key || "value"} nameKey={xAxisKey} cx="50%" cy="50%" outerRadius={100} label>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
