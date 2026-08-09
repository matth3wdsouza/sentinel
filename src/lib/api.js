import { addActivity, getAllActivity, deleteActivity, clearActivity } from "./db";

export async function saveActivity({ moduleType, summary, details }) {
  if (!moduleType) {
    console.warn(
      "[saveActivity] moduleType is nullish — this entry won't be attributable to a module:",
      { summary }
    );
  }
  try {
    const id = await addActivity({
      module_type: moduleType,
      summary,
      details,
      created_at: new Date().toISOString(),
    });
    return { id };
  } catch (err) {
    // Saving to history is a nice-to-have, not critical to the user's task —
    // so we log the error rather than interrupting their workflow with it.
    console.error("Error saving activity:", err);
    return null;
  }
}

// Unlike saveActivity above, these intentionally don't swallow errors —
// the Activity page's entire purpose is showing/managing this data, so it
// needs to know when a read, delete, or clear actually failed rather than
// silently rendering an empty list as if there were nothing to show.
export async function fetchActivity() {
  return getAllActivity();
}

export async function removeActivity(id) {
  return deleteActivity(id);
}

export async function clearAllActivity() {
  return clearActivity();
}
