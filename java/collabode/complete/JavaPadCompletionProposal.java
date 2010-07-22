package collabode.complete;

@SuppressWarnings("restriction")
public class JavaPadCompletionProposal {
    
    public final String displayString;
    public final String replacementString;
    public final int replacementLength;
    public final int replacementOffset;
    public final String imageName;
    
    JavaPadCompletionProposal(ProposalHolder holder) {
        replacementString = holder.proposal.getReplacementString();
        displayString = holder.proposal.getDisplayString();
        replacementLength = holder.proposal.getReplacementLength();
        replacementOffset = holder.proposal.getReplacementOffset();
        imageName = holder.image;
    }
}
