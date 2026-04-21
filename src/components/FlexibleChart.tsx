import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatCurrency, formatNumber } from '../lib/formatters';
import CustomTooltip from './CustomTooltip';

interface Props {
  data: any[];
  type: 'bar' | 'line' | 'area' | 'pie';
  metric: string;
  appColors: Record<string, string>;
  onDrillDown: (data: any) => void;
  hiddenApps: Set<string>;
}

export const FlexibleChart = ({ data, type, metric, appColors, onDrillDown, hiddenApps }: Props) => {
  const apps = Object.keys(appColors).filter((app) => !hiddenApps.has(app));

  const renderChart = () => {
    if (type === 'pie') {
      const pieData = apps
        .map((app) => {
          const total = data.reduce(
            (sum, item) => sum + (item.appBreakdown?.[app]?.[metric] || 0),
            0,
          );
          return { name: app, value: total, fill: appColors[app] };
        })
        .filter((d) => d.value > 0);

      return (
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={120}
            paddingAngle={5}
            dataKey="value"
          >
            {pieData.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(val: number) =>
              metric === 'revenue' ? formatCurrency(val) : formatNumber(val)
            }
            contentStyle={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
              padding: '12px',
            }}
          />
        </PieChart>
      );
    }

    const ChartComponent = type === 'bar' ? BarChart : type === 'line' ? LineChart : AreaChart;
    const DataComponent: any = type === 'bar' ? Bar : type === 'line' ? Line : Area;

    return (
      <ChartComponent
        data={data}
        onClick={(e: any) => {
          const payload = e?.activePayload?.[0]?.payload;
          if (payload) onDrillDown(payload);
        }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
          tickFormatter={(val) => {
            if (metric === 'revenue') {
              if (val >= 1000000) return `Rp${(val / 1000000).toFixed(1)}jt`;
              return `Rp${val}`;
            }
            if (metric === 'conversion') return `${val.toFixed(1)}%`;
            return formatNumber(val);
          }}
        />
        <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip metric={metric} />} />
        {apps.map((app) => (
          <DataComponent
            key={app}
            type="monotone"
            dataKey={`${metric}_${app}`}
            name={app}
            stackId="a"
            fill={appColors[app]}
            stroke={appColors[app]}
            fillOpacity={type === 'area' ? 0.1 : 1}
            strokeWidth={type === 'line' || type === 'area' ? 3 : 0}
            radius={type === 'bar' ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </ChartComponent>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      {renderChart()}
    </ResponsiveContainer>
  );
};

export default FlexibleChart;
