use super::{agent_detect_all, AgentStatus};

#[tokio::test]
async fn agent_detect_all_finds_an_agent_everyone_has() {
    // "git" is a hard dependency of the worktree feature, so it must be
    // detectable on every dev machine running these tests.
    let found = agent_detect_all(vec!["git".into()]).await;
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].command, "git");
    assert!(found[0].installed, "git should be detected as installed");
}

#[tokio::test]
async fn agent_detect_all_reports_missing_agent() {
    let found = agent_detect_all(vec!["definitely-not-a-real-cli-xyz".into()]).await;
    assert_eq!(found.len(), 1);
    assert!(!found[0].installed);
}

#[tokio::test]
async fn agent_detect_all_handles_empty_list() {
    let found = agent_detect_all(vec![]).await;
    assert!(found.is_empty());
}

// Silence the unused import warning when AgentStatus fields are only read
// through the asserts above.
#[allow(dead_code)]
struct _Keep(AgentStatus);
