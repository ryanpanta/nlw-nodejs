import z from "zod";
import { prisma } from "../../lib/prisma";
import { FastifyInstance } from "fastify";
import { redis } from "../../lib/redis";

export async function getPoll(app: FastifyInstance) {
  app.get("/polls/:pollId", async (req, res) => {
    const createPollParams = z.object({
      pollId: z.string().uuid(),
    });

    const { pollId } = createPollParams.parse(req.params);

    const poll = await prisma.poll.findUnique({
      where: {
        id: pollId,
      },
      include: {
        options: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!poll) {
      return res.status(400).send({ message: "Poll not found." });
    }

    const result = await redis.zrange(pollId, 0, -1, "WITHSCORES");

    const votes = result.reduce((acc, cur, idx) => {
      if (idx % 2 === 0) {
        const score = result[idx + 1];
        Object.assign(acc, { [cur]: Number(score) });
      }
      return acc;
    }, {} as Record<string, number>);


    return res.send({
      poll: {
        id: poll.id,
        title: poll.title,
        options: poll.options.map(item => {
          return {
            id: item.id,
            title: item.title, 
            score: (item.id in votes) ? votes[item.id] : 0
          }
        }) 
      }
    });
  });
}
