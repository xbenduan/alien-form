import {
  Profiler,
  useCallback,
  useRef,
  useState,
  type ProfilerOnRenderCallback,
} from "react";
import { Button, Card, InputNumber, Space, Table, Tag, Typography } from "antd";
import { scenes, type SceneKey } from "./scenes";
import {
  dispatchNativeInput,
  findFirstInput,
  fmt,
  type InputMetric,
  type MountMetric,
} from "./measure";

interface Result {
  scene: SceneKey;
  label: string;
  count: number;
  mount: MountMetric;
  input: InputMetric;
}

interface Aggregated {
  scene: SceneKey;
  label: string;
  count: number;
  rounds: number;
  mountCommit: number; // 中位数
  inputCommit: number; // 中位数
  mountWall: number; // 中位数
  inputWall: number; // 中位数
}

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const SCENE_KEYS = Object.keys(scenes) as SceneKey[];

// 引擎类场景:对比的核心是这两者的表单引擎,基线场景仅作参照。
const ENGINE_SCENES = new Set<SceneKey>(["alienForm", "formily"]);

// rAF + setTimeout 竞速:标签页后台时 rAF 会被节流甚至不触发,
// setTimeout 兜底保证编排不会卡死。
const nextFrame = () =>
  new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(finish);
    setTimeout(finish, 50);
  });

export default function App() {
  const [count, setCount] = useState(2000);
  const [rounds, setRounds] = useState(5);
  const [active, setActive] = useState<SceneKey | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<Aggregated[]>([]);

  const hostRef = useRef<HTMLDivElement>(null);
  // 计时窗口:capturing 期间无脑累加每次 commit 的 actualDuration。
  // 不依赖 React 的 mount/update phase —— Profiler 常驻不卸载,切换场景内容
  // 会被标记为 update,按 phase 匹配会丢失挂载耗时。
  const commitRef = useRef({ capturing: false, duration: 0 });

  const onRender = useCallback<ProfilerOnRenderCallback>((_, _phase, actualDuration) => {
    if (commitRef.current.capturing) {
      commitRef.current.duration += actualDuration;
    }
  }, []);

  const runScene = useCallback(
    async (scene: SceneKey): Promise<Result> => {
      // ---- 卸载残留 ----
      setActive(null);
      await nextFrame();
      await nextFrame();

      // ---- 挂载计时 ----
      commitRef.current = { capturing: true, duration: 0 };
      const mountStart = performance.now();
      setActive(scene);
      await nextFrame();
      await nextFrame();
      const mountWall = performance.now() - mountStart;
      const mountCommit = commitRef.current.duration;
      commitRef.current.capturing = false;

      // ---- 单次输入计时 ----
      const input = hostRef.current ? findFirstInput(hostRef.current) : null;
      let inputWall = 0;
      let inputCommit = 0;
      if (input) {
        commitRef.current = { capturing: true, duration: 0 };
        const inputStart = performance.now();
        dispatchNativeInput(input, "benchmark-typing");
        // React 18 对离散事件同步提交,这里墙钟覆盖同步提交部分
        inputWall = performance.now() - inputStart;
        await nextFrame();
        inputCommit = commitRef.current.duration;
        commitRef.current.capturing = false;
      }

      return {
        scene,
        label: scenes[scene].label,
        count,
        mount: { wallMs: mountWall, commitMs: mountCommit },
        input: { wallMs: inputWall, commitMs: inputCommit },
      };
    },
    [count],
  );

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults([]);
    setProgress("");

    // 收集每个场景在每一轮的原始样本
    const samples = new Map<SceneKey, Result[]>();
    for (const key of SCENE_KEYS) samples.set(key, []);

    // 丢弃第 0 轮(预热:JIT、字体、布局缓存未稳定)
    const totalRounds = rounds + 1;
    for (let round = 0; round < totalRounds; round++) {
      const warmup = round === 0;
      for (const scene of SCENE_KEYS) {
        setProgress(
          warmup
            ? `预热轮:${scenes[scene].label}`
            : `第 ${round}/${rounds} 轮:${scenes[scene].label}`,
        );
        // eslint-disable-next-line no-await-in-loop
        const result = await runScene(scene);
        if (!warmup) samples.get(scene)!.push(result);
      }
    }

    const aggregated: Aggregated[] = SCENE_KEYS.map((scene) => {
      const rows = samples.get(scene)!;
      return {
        scene,
        label: scenes[scene].label,
        count,
        rounds,
        mountCommit: median(rows.map((r) => r.mount.commitMs)),
        inputCommit: median(rows.map((r) => r.input.commitMs)),
        mountWall: median(rows.map((r) => r.mount.wallMs)),
        inputWall: median(rows.map((r) => r.input.wallMs)),
      };
    });

    setResults(aggregated);
    setActive(null);
    setProgress("");
    setRunning(false);
  }, [runScene, rounds, count]);

  // 以基线 Pure Antd Input 的 commit 为 1x,计算相对倍率
  const baselineMountCommit =
    results.find((r) => r.scene === "pureAntdInput")?.mountCommit ?? 0;
  const baselineInputCommit =
    results.find((r) => r.scene === "pureAntdInput")?.inputCommit ?? 0;

  const Active = active ? scenes[active].Component : null;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <Typography.Title level={3}>AlienForm Benchmark</Typography.Title>
      <Typography.Paragraph type="secondary">
        对标 formily/packages/benchmark:每种方式渲染 N 个表单字段,自动测量挂载耗时与单次输入到重渲染完成的耗时。
        <br />
        指标:<b>wall</b> = 墙钟耗时(performance.now),<b>commit</b> = React Profiler 报告的本阶段提交耗时之和。数值越小越好。
      </Typography.Paragraph>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>字段数量</span>
          <InputNumber
            min={10}
            max={5000}
            step={100}
            value={count}
            onChange={(v) => setCount(v ?? 2000)}
            disabled={running}
          />
          <span>测量轮数</span>
          <InputNumber
            min={1}
            max={30}
            step={1}
            value={rounds}
            onChange={(v) => setRounds(v ?? 5)}
            disabled={running}
          />
          <Button type="primary" loading={running} onClick={runAll}>
            运行多轮对比
          </Button>
          {progress ? (
            <Typography.Text type="secondary">{progress}</Typography.Text>
          ) : null}
        </Space>
      </Card>

      <Card
        size="small"
        title={
          results.length > 0
            ? `测量结果(${results[0].rounds} 轮中位数)`
            : "测量结果"
        }
        style={{ marginBottom: 16 }}
      >
        <Table<Aggregated>
          rowKey="scene"
          size="small"
          pagination={false}
          dataSource={[...results].sort(
            (a, b) => SCENE_KEYS.indexOf(a.scene) - SCENE_KEYS.indexOf(b.scene),
          )}
          columns={[
            {
              title: "场景",
              render: (_, r) => (
                <Space size={4}>
                  {ENGINE_SCENES.has(r.scene) ? (
                    <Tag color="purple">引擎</Tag>
                  ) : (
                    <Tag>基线</Tag>
                  )}
                  <span>{r.label}</span>
                </Space>
              ),
            },
            { title: "字段数", dataIndex: "count", width: 80 },
            {
              title: "挂载 commit (ms)",
              render: (_, r) => <Tag color="purple">{fmt(r.mountCommit)}</Tag>,
            },
            {
              title: "挂载倍率",
              render: (_, r) =>
                baselineMountCommit > 0
                  ? `${(r.mountCommit / baselineMountCommit).toFixed(2)}x`
                  : "-",
            },
            {
              title: "输入 commit (ms)",
              render: (_, r) => <Tag color="green">{fmt(r.inputCommit)}</Tag>,
            },
            {
              title: "输入倍率",
              render: (_, r) =>
                baselineInputCommit > 0
                  ? `${(r.inputCommit / baselineInputCommit).toFixed(2)}x`
                  : "-",
            },
            {
              title: "挂载 wall (ms)",
              render: (_, r) => fmt(r.mountWall),
            },
            {
              title: "输入 wall (ms)",
              render: (_, r) => fmt(r.inputWall),
            },
          ]}
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          倍率以 Pure Antd Input 基线为 1x。commit 为可信指标,wall 易受后台节流污染仅供参考。
        </Typography.Paragraph>
      </Card>

      <Card size="small" title={active ? `当前渲染:${scenes[active].label}` : "渲染区(空闲)"}>
        <div ref={hostRef} style={{ maxHeight: 320, overflow: "auto" }}>
          <Profiler id="scene" onRender={onRender}>
            {Active ? <Active count={count} /> : null}
          </Profiler>
        </div>
      </Card>
    </div>
  );
}
