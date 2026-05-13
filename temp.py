How Reasoning evolved in large language models 


When I was kid, when I just started going to school and solving some maths questions. 
I memorized the solutions 2+2 = 4, 3+3 = 6 but when I faced anything complex like 12+12 (yes it was complex for me at that time ) I could not. Thats when my teacher gave an idea, break it step by step and think out loud. Well, it worked! By breaking it down, I couldl eventually reach the solutions I remembered. 

Then I grew up, and one day my teacher asked me, you dont need to think out loud everytime, just break it in your mind and give me final answer, but remember you must think. 

Well reasoning in large language models follows the same story. 

But lets take a step back, and shortly follow how the world reached here.  

The NLP reached to masses with the introduction of ChatGPT a decoder based model by OpenAI in [insert the month and year here] 

The key idea or the differentiraltion from traidtional transformer was , while it was not just trained for next word predction but also to follow scertain instruciton and understand the langauge…. and form cohreent responses.. 
So now if you ask it to write an essay –it would 

additional it was trained on a lot of data, in-fact 'a lot' would be a lot smaller phrase to explain the data that it was trained on , hence it remembered the details. It was good at answering questin for which it rememebr the answer ,and it decent non solving prbolems. 



Introductin of reasoning?
In 2022, google at it again ..
Chain of Thought by google

The story of reasoning in LLMs truly begins on January 28, 2022, when researchers
Jason Wei, Xuezhi Wang, Dale Schuurmans, and Denny Zhou from Google Brain
published their seminal paper: "Chain-of-Thought Prompting Elicits Reasoning in
Large Language Models."
This paper introduced a deceptively simple yet revolutionary idea: instead of asking
models to produce direct answers, prompt them to generate a series of intermediate
reasoning steps—a "chain of thought"—before arriving at the final answer.
The Key Innovation:Standard Prompting: "Q: Roger has 5 tennis balls. He buys 2 cans of 3 tennis
balls each. How many does he have now? A: [answer]"
Chain-of-Thought Prompting: "Q: Roger has 5 tennis balls. He buys 2 cans of 3
tennis balls each. How many does he have now? A: Roger started with 5 balls. 2
cans of 3 tennis balls each is 6 tennis balls. 5 + 6 = 11. The answer is 11."


[link to the paper and summarize ] 

Challenges with this approach 

While this was good, and followed the idea that since model was trained  in predicting the next word , the chain of thought potmpting asks the mpdel to predict the journey to the solutoin , and since it was trained o various data , it has very well seen that ojruen as well and able to get apt steps and eventuall right ssolution.l.

but the main thing was "models" were not specifically trained to do so?

comparsing some benchmarks we reached here

[write the benchmarks] 


the period between saw a lot of other resarch including 
MOE models 
multimodal models 

small language models 

BUt in reasoning what came was the disocvery of o1 model which choud apparently "think" but deep down if you look at it , it was just a kid leaerning to "not speak up the steps it was thinking" and automatically thinking without being told to do so. 

Key ideas were:
1. The model was inherently thinking but not every step was being shown to the user, basically the hidden chain of thought

In the words of open AI
“””We believe that a hidden chain of thought presents a unique opportunity for monitoring models. Assuming it is faithful and legible, the hidden chain of thought allows us to "read the mind" of the model and understand its thought process. For example, in the future we may wish to monitor the chain of thought for signs of manipulating the user. However, for this to work the model must have freedom to express its thoughts in unaltered form, so we cannot train any policy compliance or user preferences onto the chain of thought. We also do not want to make an unaligned chain of thought directly visible to users.
""


SO now we have a mdoeol that could generate a hiddlen chain of though if required bwithout being asked to do so , and do it wihtout showing to the user. 

Now there are few questions:
HOw did they do it?
How do they decide what part to show to user and what part not?


Well, OpenAI did not rlease its training method but they did mention that they enabled it using RL and on further research inclduion of tokens like <think> and<output> played major role 


On benchmark the model perfoenmd higher than normal chain of thought 


The open source revolution : DeepSeek 

What started with a …



What started as a fun project by few people in a chinese non-AI business ….
they created an opensource model based on thinking 

lets see step by step hwo they did it 

just like the beginning of any LLM they trained a foundational model trained on next word prediction DeepSeek-V3 base
About deep seek v3 base - It was pretrained on a massive multilingual corpus of web data, code, and other sources, emphasizing high-quality filtered text to build general language understanding, though specific dataset details aren't fully disclosed in the paper.
The base model underwent standard next-token prediction during pretraining, with no initial supervised fine-tuning (SFT) mentioned
Reaching Deepseek zero :
NOT THE NEXT STEP: The next step usually for any llm after the foudnational training in supervised fine tuning so that they can follow instructions 
But The Deepseek team did an experiement and they started with a simple RL based approach. They calll it 'cold start' because it was not trained on any human curated reasoning data using any SFT.
Intro of DeepSeek- Zero 
Then, they created a basic training template that framed interactions as a user-assistant conversation, requiring the model to enclose its reasoning in tags and the final answer in tags, applied to prompts from reasoning tasks such as math problems and coding challenges.




Rewadrd model was this Next, they designed a simple reward system focused on two main types: accuracy rewards to check if responses were correct, like verifying math solutions or code outputs with rules, and format rewards to ensure the model structured its thinking between specific tags without adding content biases.
In the words of Sebastia Raschak 
For rewards, instead of using a reward model trained on human preferences, they employed two types of rewards: an accuracy reward and a format reward.
The accuracy reward uses the LeetCode compiler to verify coding answers and a deterministic system to evaluate mathematical responses.
The format reward relies on an LLM judge to ensure responses follow the expected format, such as placing reasoning steps inside <think> tags.


With these elements in place, they initiated large-scale RL training directly on the base model, sampling multiple outputs per prompt, calculating rewards, and iteratively updating the policy over thousands of steps, allowing the model to self-evolve behaviors like longer chain-of-thought processes and reflection.






and then gave rewards (rule absed ) for 
correct use of thiking tokens 
correct outputs 
in this they observed that the model developed thiking approach and started rpfeferring thinking , the called it AHA moement , and called the model DeepSeek R1- Zero 
Observation - Aha moment 
eplxain about por readability 
conslusion 

DeepSeek-R1-Zero demonstrated strong reasoning performance, achieving 71.0% pass@1 on AIME 2024 (rising to 86.7% with majority voting) and competitive scores on benchmarks like MATH-500 (95.9%) and GPQA Diamond (73.3%), matching or exceeding models like OpenAI-o1-0912 in some areas.
However, it suffered from drawbacks such as poor readability, frequent language mixing in responses, and outputs that were often chaotic or not user-friendly, limiting its practical application.

which kinds of makes sense because it waas not trained to do so 	
the aha moment - The "aha moment" in DeepSeek-R1-Zero occurred during an intermediate training stage when the model spontaneously learned to rethink and refine its approach to a math problem, using an anthropomorphic tone like "Wait, wait. Wait. That’s an aha moment I can flag here" to flag errors and reevaluate steps.
This emergent behavior showed the model allocating more "thinking time" by reflecting on its initial solution, such as isolating square roots differently, leading to better problem-solving without explicit prompts.
It highlighted RL's beauty for researchers, as the model autonomously developed sophisticated strategies purely from incentives, marking a key milestone in its self-evolution.



Next DeepSeek  - R1: thsi gained popularity as , they took deep seek r1 zero and did sft over it . and firther rlRL training 

However, they realized key limitations, like messy outputs that mixed languages and were hard to read, which made the model less practical for everyday use.
This highlighted the need for a more polished version that fixed readability issues, prevented language mixing, and expanded beyond just reasoning to handle general tasks like writing or casual questions, while potentially speeding up training and pushing performance even higher. To meet these needs, they developed DeepSeek-R1 through a step-by-step pipeline starting with a "cold start" to give the model a better foundation.


the SFT 
First, they collected a small set of high-quality examples with long, readable chain-of-thought responses—thousands of them—using techniques like prompting strong models for detailed answers, reformatting DeepSeek-R1-Zero outputs, and having humans refine them for clarity and structure, then fine-tuned the DeepSeek-V3-Base on this data to create a stable starting point.


Next, they applied reasoning-focused RL similar to DeepSeek-R1-Zero, using GRPO on tasks like math and coding, but added a reward for language consistency to avoid mixing, training until the model converged on strong reasoning scores with more coherent outputs.


Then, once that RL stabilized, they used the checkpoint to generate new training data via rejection sampling—creating multiple responses per prompt and keeping only the correct, clean ones—for reasoning, while adding non-reasoning data from DeepSeek-V3 for general skills, and fine-tuned the base model again on this expanded 800k-sample dataset for two rounds.
Finally, they ran a second RL stage to align everything with human preferences, combining rule-based rewards for reasoning with models checking helpfulness and safety across all types of prompts, resulting in DeepSeek-R1—a versatile model matching top performers like OpenAI-o1-1217 while being user-friendly.


The tool the deepskeel r1 zero model, performend SDFT over it. Details into SFT.
the data was human curated 
he researchers collected a small dataset of high-quality, long chain-of-thought (CoT) examples—thousands of them—by methods like few-shot prompting, direct generation with reflection and verification, and even gathering outputs from DeepSeek-R1-Zero that were then reformatted for readability and refined by human annotators. This data emphasized readable patterns, such as including summaries at the end of responses and filtering out messy or multilingual content. 


kay few questions:\
"but added a reward for language consistency" how did they measure language consistency. \
"fine-tuned the base model again on this expanded 800k-sample dataset for two rounds." two rounds means two iterations?
3, "Finally, they ran a second RL stage" is it similar to the normal RLHF?
Sure, I'll address each of your questions one by one based on the details from the paper.
They measured language consistency as the proportion of words in the target language (e.g., English) within the chain-of-thought output, calculating it simply as a ratio and adding it directly to the accuracy reward to encourage coherent, monolingual responses during RL training.
Yes, "two rounds" here refers to two epochs of fine-tuning on the dataset—meaning the model was trained by passing through the entire 800k-sample dataset twice, which helped stabilize and integrate the new reasoning and general-purpose data.
It's similar to standard RLHF in that it uses reward models trained on human preferences for helpfulness (focusing on the final summary) and harmlessness (checking the full output), then applies GRPO to align the model; however, it combines these with rule-based accuracy rewards for reasoning tasks, making it a more integrated approach across all scenarios rather than just preferences.


DeepSeek R2


After developing DeepSeek-R1, the team turned to distillation to empower smaller, more efficient models with its advanced reasoning capabilities, using the 800k curated samples from the rejection sampling and non-reasoning data stages to perform supervised fine-tuning on open-source base models like Qwen2.5 (1.5B, 7B, 14B, 32B) and Llama (8B, 70B). This straightforward SFT approach, without adding RL, yielded impressive results, with the distilled 7B model surpassing larger ones like QwQ-32B-Preview on benchmarks such as AIME (55.5%) and MATH-500 (92.8%), while the 32B and 70B versions set new records among dense models, often rivaling o1-mini. They open-sourced these six distilled checkpoints to help the community create better small models, noting that direct distillation from a strong teacher like DeepSeek-R1 outperformed applying RL directly to smaller bases.

The key learning from the distillation process is that transferring reasoning patterns from a powerful large model like DeepSeek-R1 to smaller ones via simple supervised fine-tuning is more efficient and effective than applying resource-intensive RL directly on small models, often yielding superior performance.

DeepSeek-R1-Zero showcased remarkable reasoning prowess through pure RL, achieving scores like 71.0% pass@1 on AIME 2024 (up to 86.7% with majority voting), 95.9% on MATH-500, and 73.3% on GPQA Diamond, matching OpenAI-o1-0912 on several metrics, but it was hampered by poor readability and language mixing, limiting its broader utility.
DeepSeek-R1 built on this with a refined pipeline, delivering performance comparable to OpenAI-o1-1217 across reasoning tasks—such as 79.8% on AIME, 97.3% on MATH-500, 71.5% on GPQA, 96.3% Codeforces percentile, and 49.2% on SWE-bench—while improving coherence and versatility in areas like writing and long-context QA, though it lagged in non-reasoning tasks like function calling and showed prompt sensitivity.
The distilled models transferred R1's strengths to smaller sizes efficiently via SFT, with the 7B version outperforming GPT-4o on math benchmarks, the 14B surpassing QwQ-32B-Preview overall, and the 32B/70B models setting new records for dense models by often exceeding OpenAI-o1-mini on reasoning evaluations like AIME (72.6%/70.0%) and MATH-500 (94.3%/94.5%), demonstrating distillation's edge over direct RL on small models





GRPO 

Now a bit more light into , the RL approach they used GRPO


So basically tll now if you have to make an fodunational lLM thining, 
first create a good data and train it using SF
followed by RL 

and you will get good results. 




Research after jan 2025



but do you think, this is thinking?


what came intereseting wa s that a paper that was relased  by researchers from apple in in late 2205 named "ilusion of thiking"

while the thinking has developed theier ability to solve medium com[lex problems.. better than standard moderls [insert examples[ [ 

but iin comp[lex problems as experimentd by the team, all the LLMs still face… 

What was very interesting was a paper released by researchers from Apple in late 2025. It is titled "The Illusion of Thinking."
These thinking tools have helped large reasoning models solve medium hard problems better than regular models. For example, they do better than models without thinking, like Claude 3.7 Sonnet without thinking or DeepSeek V3, on puzzles that need a moderate number of steps. But they still show basic limits.
But in very hard problems, as tested by the team in puzzles like Tower of Hanoi and River Crossing, all large language models, including thinking ones, completely fail. Their accuracy drops to almost zero after a certain point, even with plenty of computer power.




further to his research , there were a lot of other reserach 
some future model 
geminig thining,  gpt 5.2 [ but training process was not discolosed] 

one key area of improvement was enabling the model to decide when to think and when to not tho think 

another area was chain amd going on multiple thinking 

and reinforcement learning not jusrt rul beased but also on thinking 
bt this was it, i hope till now you atlease get a pciture of ..

and when soemone talks about reasoning model , you dont feel left out 


Alright , so how do you make a non reasoning LLM , a reasoning LLM 

one way is by prompting , this is also called inference time scaling 

second is by gcombination of SFT and RL 

this huggingface blogs - 

https://huggingface.co/blog/Metal3d/making-any-model-reasoning


by prompting alone 


my thoughts: 
well if it matters:
i think thinking llm are good, but for actual use case, i would love to see models which are experts in following a thinking framework when it is proveided to them, because most often in use case 
we do not need expert models that can hve thinking , we always have some rules defined and we need llm to take instruction based on that ,
fore example for an umpire theere is adefined freamwork for decing whether a player is lebw out or not 

similarity… 


some food for thught! 
anyways, this ends the blog, Thanks for eading till here, Happy HOlidays!





How do LLMs "reason"?
I remember as a kid, when I just started getting into calculations, I used to face difficulties in solving complex sums (like 123+246, yes this was complex for me). 
Then my teacher came to rescue, and told me to think out loud and divide the sum into smaller parts, like adding the hundreds, then the tens, and finally the units. Basically, breaking down a complex problem into small steps by steps. 
As I grew a little bit older, teacher asked me to keep dividing the problem 
