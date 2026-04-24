import { useState } from "react";
import SimpleEditView from "./views/SimpleEditView";

/**
 * App — top-level router shell.
 *
 * Current routes:
 *   "edit"  → SimpleEditView  (phrase splitting & labelling)
 *
 * Future routes (add cases below):
 *   "detail" → DetailEditView  (fine-grained crossfade editing)
 *   "export" → ExportView      (mastering / format options)
 */
export default function App() {
  const [route, setRoute] = useState("edit");

  switch (route) {
    case "edit":
    default:
      return <SimpleEditView onNavigate={setRoute} />;
  }
}
