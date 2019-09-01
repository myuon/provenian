package model

type Result struct {
	Code       string `dynamo:"status_code" json:"status_code"`
	Text       string `dynamo:"status_text" json:"status_text"`
	Message    string `dynamo:"message" json:"message"`
	IsFinished bool   `dynamo:"-" json:"is_finished"`
}

func WJ() Result {
	return Result{
		Code:       "WJ",
		Text:       "Wait for Judge...",
		IsFinished: false,
	}
}

func CE(message string) Result {
	return Result{
		Code:       "CE",
		Text:       message,
		IsFinished: true,
	}
}

func V(message string) Result {
	return Result{
		Code:       "V",
		Text:       message,
		IsFinished: true,
	}
}

type Submission struct {
	ID        string `dynamo:"id" json:"id"`
	CreatedAt int64  `dynamo:"created_at" json:"created_at"`
	ProblemID string `dynamo:"problem_id" json:"problem_id"`
	Code      string `dynamo:"code" json:"code"`
	Language  string `dynamo:"language" json:"language"`
	UserID    string `dynamo:"user_id" json:"user_id"`
	Result    Result `dynamo:"result" json:"result"`
}
