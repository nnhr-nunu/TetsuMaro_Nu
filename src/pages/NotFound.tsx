import { Link } from "react-router";
import { btnSecondary } from "../buttons";
import { useTitle } from "../useTitle";

export function NotFound({ message = "ページが見つかりませんでした。" }: { message?: string }) {
	useTitle("ページが見つかりません");
	return (
		<div className="space-y-6 py-12 text-center">
			<p className="text-lg">{message}</p>
			<Link to="/" className={btnSecondary}>
				トップへ
			</Link>
		</div>
	);
}
