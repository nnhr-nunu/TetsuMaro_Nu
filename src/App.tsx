import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigationType } from "react-router";
import { InfoSheetProvider } from "./components/InfoSheet";
import { Layout } from "./components/Layout";
import { ConsultationPage } from "./pages/Consultation";
import { HomePage } from "./pages/Home";
import { MePage } from "./pages/Me";
import { NotFound } from "./pages/NotFound";
import { PhilosopherPage } from "./pages/Philosopher";
import { PhilosophersPage } from "./pages/Philosophers";
import { SearchPage } from "./pages/Search";
import { ThemePage } from "./pages/Theme";

// めったに開かない画面（管理・規約類）は、開いたときに読み込む（最初の読み込みを軽くするため）
const AdminPage = lazy(() => import("./pages/Admin").then((m) => ({ default: m.AdminPage })));
const TermsPage = lazy(() => import("./pages/Terms").then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import("./pages/Privacy").then((m) => ({ default: m.PrivacyPage })));

/** リンクで別の画面へ移ったら、いちばん上から見せる。戻る・進むと、# のあるリンクは動かさない */
function ScrollToTop() {
	const { pathname, hash } = useLocation();
	const type = useNavigationType();
	useEffect(() => {
		if (type !== "POP" && !hash) window.scrollTo({ top: 0 });
	}, [pathname, hash, type]);
	return null;
}

export function App() {
	return (
		<BrowserRouter>
			<ScrollToTop />
			<InfoSheetProvider>
				<Layout>
					<Suspense fallback={<p className="text-ink-soft">読み込み中…</p>}>
						<Routes>
							<Route path="/" element={<HomePage />} />
							<Route path="/c/:id" element={<ConsultationPage />} />
							<Route path="/search" element={<SearchPage />} />
							<Route path="/theme/:category" element={<ThemePage />} />
							<Route path="/philosophers" element={<PhilosophersPage />} />
							<Route path="/philosophers/:id" element={<PhilosopherPage />} />
							<Route path="/me" element={<MePage />} />
							<Route path="/terms" element={<TermsPage />} />
							<Route path="/privacy" element={<PrivacyPage />} />
							<Route path="/admin" element={<AdminPage />} />
							<Route path="*" element={<NotFound />} />
						</Routes>
					</Suspense>
				</Layout>
			</InfoSheetProvider>
		</BrowserRouter>
	);
}
