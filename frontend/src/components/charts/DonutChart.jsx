import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function DonutChart({ data }) {
  return (
    <div className="flex items-center gap-3">
      <ResponsiveContainer width={80} height={80}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={25}
            outerRadius={38}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-[#0f1117] border border-white/20 rounded px-2 py-1 text-xs">
                  <span style={{ color: payload[0].payload.color }}>{payload[0].name}</span>
                  <span className="text-white ml-1">{payload[0].value}%</span>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
            <div className="w-2 h-2 rounded-sm" style={{ background: d.color }} />
            <span>{d.name}</span>
            <span className="text-slate-300 font-medium ml-auto pl-2">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
