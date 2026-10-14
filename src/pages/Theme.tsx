import { Link, useParams, useSearchParams } from "react-router";
import { type CategoryId, categoryName, isCategory, tagsOf } from "../../shared/themes";
import { btnSecondary } from "../buttons";
import { FilterChips } from "../components/FilterChips";
import { SharedResults } from "../components/SharedResults";
import { Icon } from "../icons";
import { useTitle } from "../useTitle";
import { NotFound } from "./NotFound";

/** 見出し。「自分のこと」だけは「の悩み」を付けると不自然なので言い換える */
const heading = (id: CategoryId) => (id === "self" ? "自分についての悩み" : `${categoryName(id)}の悩み`);

export function ThemePage() {
	const { category = "" } = useParams();
	const [params, setParams] = useSearchParams();
	useTitle(isCategory(category) ? heading(category) : null);
	if (!isCategory(category)) return <NotFound message="このテーマは見つかりませんでした。" />;

	const tags = tagsOf(category);
	const tag = tags.find((t) => t.id === params.get("tag"))?.id ?? null;
	const filters = new URLSearchParams({ category, ...(tag ? { tag } : {}) });

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold sm:text-3xl">{heading(category)}</h1>
			{tags.length > 0 && <FilterChips label={`${categoryName(category)}の内容`} options={tags} value={tag} onChange={(next) => setParams(next ? { tag: next } : {})} />}
			<SharedResults query={filters.toString()} empty={<p>まだ共有された相談はありません。</p>} />
			<Link to={`/search?${filters}`} className={btnSecondary}>
				言葉や哲学者でも絞り込む
				<Icon name="arrow" />
			</Link>
		</div>
	);
}
