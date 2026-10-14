import { useEffect } from "react";
import { SITE_NAME, TOP_TITLE } from "../shared/site";

/**
 * ページの題名を「〇〇｜哲マロ(ぬ)」にする。null（読み込み中など）なら変えない。
 * ページを離れたらトップの題名に戻す（性癖カルテと同じ）
 */
export function useTitle(name: string | null): void {
	useEffect(() => {
		if (name === null) return;
		document.title = `${name}｜${SITE_NAME}`;
		return () => {
			document.title = TOP_TITLE;
		};
	}, [name]);
}
