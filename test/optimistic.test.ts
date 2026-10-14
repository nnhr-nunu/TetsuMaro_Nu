import { describe, expect, it } from "vitest";
import { sendOptimistic } from "../src/optimistic";

describe("sendOptimistic", () => {
	it("送れたら、押した状態のまま送った結果を返す", async () => {
		const log: string[] = [];
		const r = await sendOptimistic(
			() => log.push("apply"),
			() => log.push("revert"),
			async () => ({ count: 3 }),
		);
		expect(r).toEqual({ ok: true, value: { count: 3 } });
		expect(log).toEqual(["apply"]);
	});
	it("送れなかったら、押す前に戻して失敗を返す", async () => {
		const log: string[] = [];
		const error = new Error("network");
		const r = await sendOptimistic(
			() => log.push("apply"),
			() => log.push("revert"),
			async () => {
				throw error;
			},
		);
		expect(r).toEqual({ ok: false, error });
		expect(log).toEqual(["apply", "revert"]);
	});
});
