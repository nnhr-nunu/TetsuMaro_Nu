import { BrowserRouter, Route, Routes } from "react-router";

export function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="*" element={<p className="p-4">哲マロ(ぬ)</p>} />
			</Routes>
		</BrowserRouter>
	);
}
